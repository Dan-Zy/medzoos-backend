/**
 * Clinical Triage Pipeline — authoritative backend decision flow.
 *
 * USER MESSAGE
 *   → RedFlagEngine (deterministic, no LLM)
 *   → Structured Extraction (LLM or heuristic)
 *   → Clarification if needed
 *   → TriageEngine + protocols + exercise safety
 *   → Provider Discovery (live DB, never LLM)
 *   → ActionCardBuilder
 *   → TriageResponse
 */

const { evaluateRedFlags } = require('./triage/redFlagEngine');
const { extractSymptoms } = require('./extraction/symptomExtractor');
const { runTriageEngine } = require('./triage/triageEngine');
const { getProtocol } = require('./protocols/clinicalProtocols');
const { resolveLabs } = require('./protocols/labMapping');
const {
  buildActionCards,
  buildPatientText,
  buildSuggestedReplies,
} = require('./response/actionCardBuilder');
const { discoverProviders } = require('./providers/providerDiscoveryService');
const { recordTriageAudit } = require('./audit/triageAudit');
const { loadHealthContext } = require('./HealthContextLoader');
const { PROTOCOL_VERSION, triageLevelToRisk } = require('./types/copilot.types');
const { buildClarification } = require('./triage/urgencyRules');

/**
 * Map rich HealthContextLoader output → minimal triage HealthContext.
 */
function toTriageHealthContext(raw) {
  if (!raw) {
    return {
      age: null,
      gender: null,
      chronicConditions: [],
      activeMedications: [],
      allergies: [],
      recentLabs: [],
      recentDiagnoses: [],
      recentAppointments: [],
      personal: {},
    };
  }

  const allergies = [];
  const a = raw.allergies || {};
  if (Array.isArray(a.medicine)) allergies.push(...a.medicine);
  if (Array.isArray(a.food)) allergies.push(...a.food);

  const vaultMeds = [];
  const vault = raw.familyVault?.members || [];
  for (const m of vault) {
    // members may not include medicines in mapped shape — ignore safely
  }

  return {
    age: raw.personal?.age ?? null,
    gender: raw.personal?.gender ?? null,
    chronicConditions: raw.conditions || [],
    activeMedications: raw.currentMedicines?.map((m) => m.name).filter(Boolean) || vaultMeds,
    allergies,
    recentLabs: (raw.labReports || []).map((r) => ({
      name: r.name,
      date: r.date,
    })),
    recentDiagnoses: [],
    recentAppointments: raw.upcomingAppointments || [],
    pregnancyStatus: undefined,
    personal: raw.personal,
  };
}

/**
 * Merge prior session answers into extraction-friendly map.
 */
function answersFromSession(session) {
  return session?.answers && typeof session.answers === 'object' ? session.answers : {};
}

/**
 * Enrich extraction from free-text follow-up answers (e.g. "7–10 / 10").
 */
function mergeAnswerHints(extraction, message, answers) {
  const next = { ...extraction };
  const blob = `${message} ${Object.values(answers).join(' ')}`.toLowerCase();

  if (next.severityScale == null) {
    if (/7\s*[-–]\s*10|9\s*\/\s*10|8\s*\/\s*10|10\s*\/\s*10|severe/.test(blob)) {
      next.severityScale = 8;
    } else if (/4\s*[-–]\s*6|5\s*\/\s*10|moderate/.test(blob)) {
      next.severityScale = 5;
    } else if (/1\s*[-–]\s*3|2\s*\/\s*10|mild/.test(blob)) {
      next.severityScale = 2;
    }
  }

  if (next.durationHours == null || next.onset === 'unknown') {
    if (/just now|within the last hour/.test(blob)) {
      next.onset = 'sudden';
      next.durationHours = next.durationHours ?? 1;
    } else if (/today|last night/.test(blob)) {
      next.durationHours = next.durationHours ?? 12;
      if (next.onset === 'unknown') next.onset = 'gradual';
    } else if (/few days|1.?3 days/.test(blob)) {
      next.durationHours = next.durationHours ?? 48;
      if (next.onset === 'unknown') next.onset = 'gradual';
    } else if (/week|more than 3/.test(blob)) {
      next.durationHours = next.durationHours ?? 96;
      if (next.onset === 'unknown') next.onset = 'gradual';
    }
  }

  if ((!next.chiefComplaint || next.chiefComplaint === 'general_symptom') && /back/.test(blob)) {
    next.chiefComplaint = 'lower_back_pain';
    next.bodySite = 'back';
  }
  if ((!next.chiefComplaint || next.chiefComplaint === 'general_symptom') && /chest/.test(blob)) {
    next.chiefComplaint = 'chest_pain';
    next.bodySite = 'chest';
  }
  if ((!next.chiefComplaint || next.chiefComplaint === 'general_symptom') && /fever/.test(blob)) {
    next.chiefComplaint = 'fever';
  }

  return next;
}

/**
 * Run full triage for a user message.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.message
 * @param {object} [opts.session]
 * @param {boolean} [opts.skipHealthContext] - for emergency fast path tests
 */
async function runClinicalTriage({ userId, message, session = null }) {
  const redFlag = evaluateRedFlags(message);

  // ——— Layer 1: Emergency fast path — no LLM, minimal DB ———
  if (redFlag.triggered) {
    const decision = runTriageEngine({
      extraction: {},
      healthContext: null,
      userMessage: message,
      redFlag,
    });
    const actions = buildActionCards({
      decision,
      extraction: {},
      labs: [],
    });
    const response = {
      triageLevel: 'EMERGENCY',
      emergency: true,
      reasonCode: decision.reasonCode,
      reasoning: decision.reasoning,
      text: buildPatientText(decision, null),
      actions,
      suggestedReplies: [],
      metadata: {
        protocolVersion: PROTOCOL_VERSION,
        redFlagsTriggered: redFlag.matchedRules,
        rulesTriggered: decision.rulesTriggered,
        confidence: 1,
      },
      // Mobile compatibility
      riskLevel: triageLevelToRisk('EMERGENCY'),
      providers: null,
    };

    recordTriageAudit({
      userId,
      triageLevel: response.triageLevel,
      reasonCode: response.reasonCode,
      protocolVersion: PROTOCOL_VERSION,
      redFlagsTriggered: redFlag.matchedRules,
      rulesTriggered: decision.rulesTriggered,
      extractionSource: 'bypassed',
    });

    return response;
  }

  // Load health context only after emergency bypass
  let healthContext = null;
  if (userId) {
    try {
      const raw = await loadHealthContext(userId);
      healthContext = toTriageHealthContext(raw);
    } catch {
      healthContext = toTriageHealthContext(null);
    }
  }

  const answers = answersFromSession(session);
  const { extraction: rawExtraction, source: extractionSource, error: extractionError } =
    await extractSymptoms(message, answers);

  let extraction = mergeAnswerHints(rawExtraction, message, answers);

  // If LLM failed completely and we have almost nothing — ask clarifying questions
  if (extractionError && !extraction.chiefComplaint) {
    const clarification = buildClarification(['chiefComplaint']);
    recordTriageAudit({
      userId,
      triageLevel: clarification.triageLevel,
      reasonCode: clarification.reasonCode,
      protocolVersion: PROTOCOL_VERSION,
      extractionSource,
      rulesTriggered: ['EXTRACTION_FAILURE_SAFE_FALLBACK'],
    });
    return {
      ...clarification,
      emergency: false,
      metadata: {
        protocolVersion: PROTOCOL_VERSION,
        extractionSource,
        extractionError,
      },
      riskLevel: null,
      providers: null,
    };
  }

  const decision = runTriageEngine({
    extraction,
    healthContext,
    userMessage: message,
    redFlag,
    session,
  });

  if (decision.clarification || decision.triageLevel === 'NEEDS_MORE_INFORMATION') {
    const clarification = {
      triageLevel: 'NEEDS_MORE_INFORMATION',
      emergency: false,
      reasonCode: decision.reasonCode || 'MISSING_CLINICAL_DETAIL',
      reasoning: decision.reasoning,
      text: decision.text,
      actions: [],
      suggestedReplies: decision.suggestedReplies || [],
      questionKey: decision.questionKey || undefined,
      metadata: {
        protocolVersion: PROTOCOL_VERSION,
        rulesTriggered: decision.rulesTriggered,
        extractionSource,
        confidence: extraction.confidence,
      },
      riskLevel: null,
      providers: null,
    };
    recordTriageAudit({
      userId,
      triageLevel: clarification.triageLevel,
      reasonCode: clarification.reasonCode,
      protocolVersion: PROTOCOL_VERSION,
      chiefComplaint: extraction.chiefComplaint,
      extractionSource,
      rulesTriggered: decision.rulesTriggered,
    });
    return clarification;
  }

  const protocol = getProtocol(decision.protocolId);
  const labs = resolveLabs(decision.protocolId, extraction.testHint);
  const actions = buildActionCards({
    decision,
    extraction,
    labs,
    exerciseProtocol: decision.exerciseProtocol,
    protocol,
  });

  // Live provider discovery — NOT sent to LLM
  let providers = null;
  try {
    if (
      extraction.requestedIntent === 'doctor_search' ||
      decision.triageLevel === 'URGENT' ||
      decision.triageLevel === 'ROUTINE'
    ) {
      const doctors = await discoverProviders({
        type: 'doctor',
        specialty: decision.specialty,
        limit: 3,
      });
      providers = { doctors: doctors.results };
    } else if (extraction.requestedIntent === 'lab_test') {
      const labData = await discoverProviders({
        type: 'lab',
        testSlug: extraction.testHint || labs[0]?.slug,
        limit: 3,
      });
      providers = labData.results;
    } else if (extraction.requestedIntent === 'pharmacy_search') {
      const rx = await discoverProviders({ type: 'pharmacy', limit: 3 });
      providers = { pharmacies: rx.results };
    }
  } catch {
    providers = null;
  }

  const text = buildPatientText(decision, protocol);
  const suggestedReplies = buildSuggestedReplies(decision, decision.specialty);

  const response = {
    triageLevel: decision.triageLevel,
    emergency: false,
    reasonCode: decision.reasonCode,
    reasoning: decision.reasoning,
    text,
    actions,
    suggestedReplies,
    metadata: {
      protocol: decision.protocolId || undefined,
      specialty: decision.specialty || undefined,
      confidence: extraction.confidence,
      protocolVersion: PROTOCOL_VERSION,
      rulesTriggered: decision.rulesTriggered,
      redFlagsTriggered: [],
      extractionSource,
    },
    riskLevel: triageLevelToRisk(decision.triageLevel),
    providers,
    // Keep differentials empty — we do not diagnose
    differentials: [],
  };

  recordTriageAudit({
    userId,
    triageLevel: response.triageLevel,
    reasonCode: response.reasonCode,
    protocolVersion: PROTOCOL_VERSION,
    chiefComplaint: extraction.chiefComplaint,
    requestedIntent: extraction.requestedIntent,
    protocolId: decision.protocolId,
    extractionSource,
    rulesTriggered: decision.rulesTriggered,
  });

  return response;
}

module.exports = {
  runClinicalTriage,
  toTriageHealthContext,
  mergeAnswerHints,
};
