/**
 * Layer 3/4 — Deterministic triage engine.
 * LLM never sets triageLevel.
 */

const { PROTOCOL_VERSION } = require('../types/copilot.types');
const { evaluateRiskFactors, applyRiskEscalation } = require('./riskFactors');
const {
  matchUrgentRules,
  getMissingRequiredFields,
  buildClarification,
} = require('./urgencyRules');
const {
  selectProtocolId,
  getProtocol,
} = require('../protocols/clinicalProtocols');
const { resolveSpecialty } = require('../protocols/specialtyMapping');
const { screenExerciseSafety, selectExerciseProtocol } = require('../protocols/exerciseProtocols');
const { normalizeText, detectUserLanguage } = require('./textNormalizer');

/**
 * @param {object} params
 * @param {object} params.extraction
 * @param {object|null} params.healthContext
 * @param {string} params.userMessage
 * @param {{ triggered: boolean, reasonCode?: string|null }} params.redFlag
 */
function runTriageEngine({ extraction, healthContext, userMessage, redFlag, session = null }) {
  const rulesTriggered = [];

  if (redFlag?.triggered) {
    return {
      triageLevel: 'EMERGENCY',
      emergency: true,
      reasonCode: redFlag.reasonCode || 'CHEST_PAIN_RED_FLAG',
      reasoning: redFlag.patientReason || 'A potentially life-threatening symptom pattern was detected.',
      protocolId: null,
      specialty: null,
      exerciseProtocol: null,
      exerciseAllowed: false,
      rulesTriggered: [redFlag.reasonCode].filter(Boolean),
      protocolVersion: PROTOCOL_VERSION,
    };
  }

  // Check specialized Diabetes Intelligence
  const { extractDiabetesEntities, evaluateDiabetesTriage } = require('../diabetes/DiabetesIntelligenceEngine');
  const dEntities = extraction.diabetesEntities || extractDiabetesEntities(userMessage);
  if (dEntities?.hasDiabetesContext) {
    const dTriage = evaluateDiabetesTriage({
      entities: dEntities,
      userMessage,
      healthContext,
    });
    if (dTriage && dTriage.triggered) {
      return {
        triageLevel: dTriage.triageLevel,
        emergency: dTriage.triageLevel === 'EMERGENCY',
        reasonCode: dTriage.reasonCode,
        reasoning: dTriage.reasoning,
        text: dTriage.text,
        protocolId: dTriage.protocolId,
        specialty: dTriage.specialty || 'Endocrinologist',
        exerciseProtocol: null,
        exerciseAllowed: false,
        rulesTriggered: [dTriage.reasonCode],
        actions: dTriage.actions,
        suggestedReplies: dTriage.suggestedReplies,
        protocolVersion: PROTOCOL_VERSION,
        diabetesEntities: dEntities,
      };
    }
  }

  // Check specialized Mental Health Intelligence
  const { extractMentalHealthEntities, evaluateMentalHealthTriage } = require('../mentalhealth/MentalHealthIntelligenceEngine');
  const mhEntities = extraction.mentalHealthEntities || extractMentalHealthEntities(userMessage);
  if (mhEntities?.hasMentalHealthContext) {
    const mhTriage = evaluateMentalHealthTriage({
      entities: mhEntities,
      userMessage,
      healthContext,
    });
    if (mhTriage && mhTriage.triggered) {
      return {
        triageLevel: mhTriage.triageLevel,
        emergency: mhTriage.triageLevel === 'EMERGENCY',
        reasonCode: mhTriage.reasonCode,
        reasoning: mhTriage.reasoning,
        text: mhTriage.text,
        protocolId: mhTriage.protocolId,
        specialty: mhTriage.specialty || 'Psychiatrist',
        exerciseProtocol: null,
        exerciseAllowed: false,
        rulesTriggered: [mhTriage.reasonCode],
        actions: mhTriage.actions,
        suggestedReplies: mhTriage.suggestedReplies,
        protocolVersion: PROTOCOL_VERSION,
        mentalHealthEntities: mhEntities,
      };
    }
  }

  // Rapidly worsening language triggers URGENT immediately without clarification delay
  const textNorm = normalizeText(userMessage);
  if (/getting worse|worsening rapidly|much worse|rapidly worsening|bohat tez barh/i.test(textNorm)) {
    return {
      triageLevel: 'URGENT',
      emergency: false,
      reasonCode: 'RAPIDLY_WORSENING',
      reasoning: 'Rapidly worsening symptoms indicate prompt clinical assessment is required.',
      protocolId: null,
      specialty: resolveSpecialty(extraction.chiefComplaint, extraction.specialtyHint),
      exerciseProtocol: null,
      exerciseAllowed: false,
      rulesTriggered: ['RAPIDLY_WORSENING'],
      protocolVersion: PROTOCOL_VERSION,
    };
  }

  const missing = getMissingRequiredFields(extraction);
  if (missing.length > 0) {
    const { evaluateClarificationNeed } = require('../clarification/ClinicalClarificationEngine');
    const clarificationDecision = evaluateClarificationNeed({
      extraction,
      session,
      userLanguage: detectUserLanguage(userMessage),
      missingFields: missing,
      userMessage,
    });

    if (clarificationDecision && clarificationDecision.needsClarification) {
      return {
        triageLevel: 'NEEDS_MORE_INFORMATION',
        emergency: false,
        reasonCode: 'MISSING_CLINICAL_DETAIL',
        reasoning: clarificationDecision.reasoning,
        text: clarificationDecision.text,
        actions: [],
        suggestedReplies: clarificationDecision.suggestedReplies,
        protocolId: null,
        specialty: null,
        exerciseProtocol: null,
        exerciseAllowed: false,
        rulesTriggered: ['MISSING_CLINICAL_DETAIL'],
        protocolVersion: PROTOCOL_VERSION,
        clarification: true,
        questionKey: clarificationDecision.questionKey,
      };
    }
    // If clarification budget exhausted or user skipped, proceed gracefully to conservative triage
  }

  const risk = evaluateRiskFactors(healthContext);
  rulesTriggered.push(...risk.factors.map((f) => `RISK_${f.toUpperCase()}`));

  // Explicit risk escalations
  const escalation = applyRiskEscalation(extraction, risk);
  if (escalation.escalateTo === 'EMERGENCY') {
    return {
      triageLevel: 'EMERGENCY',
      emergency: true,
      reasonCode: escalation.reasonCode,
      reasoning: 'High-risk patient factors with concerning symptoms require emergency care.',
      protocolId: null,
      specialty: resolveSpecialty(extraction.chiefComplaint, extraction.specialtyHint),
      exerciseProtocol: null,
      exerciseAllowed: false,
      rulesTriggered: [...rulesTriggered, escalation.reasonCode],
      protocolVersion: PROTOCOL_VERSION,
    };
  }

  const urgent = matchUrgentRules(extraction, risk);
  let triageLevel = 'ROUTINE';
  let reasonCode = 'PERSISTENT_MILD_SYMPTOMS';

  if (urgent) {
    triageLevel = 'URGENT';
    reasonCode = urgent.reasonCode;
    rulesTriggered.push(...urgent.rulesTriggered);
  } else if (escalation.escalateTo === 'URGENT') {
    triageLevel = 'URGENT';
    reasonCode = escalation.reasonCode;
    rulesTriggered.push(escalation.reasonCode);
  } else {
    // Self-care eligibility
    const protocolId = selectProtocolId(extraction);
    const protocol = getProtocol(protocolId);
    const mild =
      (extraction.severityScale == null || extraction.severityScale <= 3) &&
      extraction.onset !== 'sudden' &&
      !risk.hasCardiovascularDisease;

    const selfCareEligible =
      mild &&
      (extraction.requestedIntent === 'general_health' ||
        extraction.requestedIntent === 'exercise' ||
        protocolId === 'wellness_general' ||
        protocolId === 'cough_cold_mild' ||
        protocolId === 'headache_mild' ||
        protocolId === 'lower_back_pain_mechanical');

    if (selfCareEligible && protocol) {
      triageLevel = 'SELF_CARE';
      reasonCode =
        protocolId === 'lower_back_pain_mechanical'
          ? 'MECHANICAL_BACK_PAIN'
          : protocolId === 'wellness_general'
            ? 'WELLNESS_QUERY'
            : 'LOW_RISK_SELF_CARE';
      rulesTriggered.push(reasonCode);
    } else {
      reasonCode = protocolId === 'lower_back_pain_mechanical'
        ? 'MECHANICAL_BACK_PAIN'
        : 'CLINICIAN_REVIEW_ADVISED';
      rulesTriggered.push(reasonCode);
    }
  }

  // Rapidly worsening language
  const text = normalizeText(userMessage);
  if (/getting worse|worsening rapidly|much worse/.test(text) && triageLevel !== 'EMERGENCY') {
    triageLevel = 'URGENT';
    reasonCode = 'RAPIDLY_WORSENING';
    rulesTriggered.push('RAPIDLY_WORSENING');
  }

  const protocolId = selectProtocolId(extraction);
  const specialty =
    resolveSpecialty(extraction.chiefComplaint, extraction.specialtyHint) ||
    getProtocol(protocolId)?.specialty ||
    null;

  // Exercise safety
  let exerciseAllowed = false;
  let exerciseProtocol = null;
  if (
    (extraction.requestedIntent === 'exercise' || triageLevel === 'SELF_CARE') &&
    triageLevel !== 'EMERGENCY' &&
    triageLevel !== 'URGENT'
  ) {
    const screen = screenExerciseSafety(userMessage, extraction);
    if (!screen.allowed) {
      triageLevel = 'URGENT';
      reasonCode = screen.reasonCode || 'EXERCISE_CONTRAINDICATED_RED_FLAG';
      rulesTriggered.push(reasonCode);
      exerciseAllowed = false;
    } else {
      exerciseAllowed = true;
      exerciseProtocol = selectExerciseProtocol(extraction);
    }
  }

  const protocol = getProtocol(protocolId);
  const reasoning =
    triageLevel === 'URGENT'
      ? 'Symptoms and/or risk factors indicate prompt in-person or specialist evaluation.'
      : triageLevel === 'SELF_CARE'
        ? 'Available information is consistent with a low-risk pattern without detected emergency red flags.'
        : protocol?.patientSummary ||
          'Symptoms may benefit from clinician evaluation without detected emergency red flags.';

  return {
    triageLevel,
    emergency: false,
    reasonCode,
    reasoning,
    protocolId,
    specialty,
    exerciseProtocol,
    exerciseAllowed,
    rulesTriggered,
    protocolVersion: PROTOCOL_VERSION,
    riskFactors: risk.factors,
  };
}

module.exports = {
  runTriageEngine,
};
