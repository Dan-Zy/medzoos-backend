/**
 * Layer 2 — Structured symptom extraction via LLM.
 * Falls back to deterministic heuristic extraction when LLM unavailable/fails.
 * Never decides triage urgency.
 */

const OpenAI = require('openai');
const env = require('../../../config/env');
const { logger } = require('../../../utils/logger');
const { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } = require('./extractionPrompt');
const { validateExtraction } = require('./extractionSchema');
const { normalizeText } = require('../triage/textNormalizer');

let client = null;

/**
 * Strip LLM-invented fields that are not supported by the raw user text.
 * Never trust the model to invent severity/duration/onset.
 */
function sanitizeExtractionAgainstSource(extraction, message, answers = {}) {
  const blob = normalizeText(`${message} ${Object.values(answers).join(' ')}`);
  const next = { ...extraction, associatedSymptoms: [...(extraction.associatedSymptoms || [])] };

  const hasSeverityHint =
    /\b([1-9]|10)\s*\/\s*10\b/.test(blob) ||
    /\b(mild|moderate|severe|worst)\b/.test(blob) ||
    /\bpain\s+([1-9]|10)\b/.test(blob) ||
    Boolean(answers.severity);

  if (!hasSeverityHint) {
    next.severityScale = null;
  }

  const hasDurationHint =
    /\b(hour|hours|day|days|week|weeks|yesterday|today|last night|just now|sudden|gradual)\b/.test(
      blob,
    ) ||
    Boolean(answers.duration) ||
    Boolean(answers.onset);

  if (!hasDurationHint) {
    next.durationHours = null;
    next.onset = 'unknown';
  }

  return next;
}

function getClient() {
  if (!env.OPENAI_API_KEY?.trim()) return null;
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

/**
 * Deterministic fallback extractor (no LLM).
 * @param {string} message
 * @param {Record<string, string>} [answers]
 */
function heuristicExtract(message, answers = {}) {
  const t = normalizeText(message);
  const answerBlob = normalizeText(Object.values(answers).join(' '));
  const blob = `${t} ${answerBlob}`.trim();

  let severityScale = null;
  const sevMatch = blob.match(/\b([1-9]|10)\s*\/\s*10\b/) || blob.match(/\bpain\s+([1-9]|10)\b/);
  if (sevMatch) severityScale = Number(sevMatch[1]);
  if (answers.severity?.includes('9') || answers.severity?.includes('Worst')) severityScale = 9;
  if (answers.severity?.includes('7') || answers.severity?.includes('Severe')) severityScale = 8;
  if (answers.severity?.includes('4') || answers.severity?.includes('Moderate')) severityScale = 5;
  if (answers.severity?.includes('1') || answers.severity?.includes('Mild')) severityScale = 2;

  let durationHours = null;
  if (answers.duration === 'Less than 24 hours' || /last night|today|hours?/.test(blob)) durationHours = 12;
  if (answers.duration === '1–3 days' || /1.?3 days|few days/.test(blob)) durationHours = 48;
  if (answers.duration === 'More than 3 days' || /more than 3 days|week/.test(blob)) durationHours = 96;
  if (answers.onset === 'Just now' || answers.onset === 'Within the last hour') {
    durationHours = durationHours ?? 1;
  }

  let onset = 'unknown';
  if (/sudden|just now|within the last hour/.test(blob) || answers.onset?.includes('Just now')) {
    onset = 'sudden';
  } else if (/gradual|few days|over a week/.test(blob)) {
    onset = 'gradual';
  }

  const associated = [];
  const checks = [
    ['fever', /\bfever\b/],
    ['cough', /\bcough\b/],
    ['sweating', /\bsweat|clammy\b/],
    ['shortness_of_breath', /shortness of breath|breathless/],
    ['nausea', /\bnausea|vomit\b/],
    ['headache', /\bheadache\b/],
    ['weakness', /\bweakness\b/],
    ['rash', /\brash\b/],
  ];
  for (const [name, re] of checks) {
    if (re.test(blob)) associated.push(name);
  }

  let bodySite = null;
  if (/chest/.test(blob)) bodySite = 'chest';
  else if (/back|kamar/.test(blob)) bodySite = 'back';
  else if (/abdomen|stomach/.test(blob)) bodySite = 'abdomen';
  else if (/head/.test(blob)) bodySite = 'head';
  else if (/foot|feet/.test(blob)) bodySite = 'foot';
  else if (/throat/.test(blob)) bodySite = 'throat';

  let chiefComplaint = null;
  if (/chest pain/.test(blob)) chiefComplaint = 'chest_pain';
  else if (/back pain|lower back/.test(blob)) chiefComplaint = 'lower_back_pain';
  else if (/fever/.test(blob)) chiefComplaint = 'fever';
  else if (/cough|cold/.test(blob)) chiefComplaint = 'cough_cold';
  else if (/headache/.test(blob)) chiefComplaint = 'headache';
  else if (/rash|skin/.test(blob)) chiefComplaint = 'skin_rash';
  else if (/foot.*wound|diabetic foot|wound/.test(blob)) chiefComplaint = 'foot_wound';
  else if (/vomit/.test(blob)) chiefComplaint = 'vomiting';
  else if (blob) chiefComplaint = 'general_symptom';

  let requestedIntent = 'triage';
  if (/exercise|stretch|mobility|physio routine/.test(blob)) requestedIntent = 'exercise';
  else if (
    /can you book|book (an? )?appointment|appointment book|mere liye book|kaise book|help me book/.test(
      blob,
    )
  ) {
    requestedIntent = 'doctor_search';
  } else if (/lab|cbc|blood test|hba1c|test result/.test(blob)) requestedIntent = 'lab_test';
  else if (/doctor|specialist|physio|cardiolog|dermatolog|appoint|docotr|docter/.test(blob)) {
    requestedIntent = 'doctor_search';
  } else if (/pharmacy|medicine|refill|prescription/.test(blob)) {
    requestedIntent = 'pharmacy_search';
  } else if (/wellness|diet|hydration|prevent/.test(blob)) {
    requestedIntent = 'general_health';
  }

  let specialtyHint = null;
  if (/physio|physiotherap|back pain/.test(blob)) specialtyHint = 'Orthopedic';
  if (/cardio|chest|heart/.test(blob)) specialtyHint = 'Cardiologist';
  if (/derma|rash|skin/.test(blob)) specialtyHint = 'Dermatologist';
  if (/psychiatr|anxiety|depress/.test(blob)) specialtyHint = 'Psychiatrist';
  if (/child|pediatric|baby/.test(blob)) specialtyHint = 'Pediatrician';
  if (/gynae|pregnan/.test(blob)) specialtyHint = 'Gynecologist';
  if (/fever|gp|general physician|cough/.test(blob) && !specialtyHint) {
    specialtyHint = 'General Physician';
  }

  let testHint = null;
  if (/\bcbc\b|complete blood/.test(blob)) testHint = 'cbc';
  if (/hba1c|a1c/.test(blob)) testHint = 'hba1c';
  if (/ecg|ekg/.test(blob)) testHint = 'ecg';
  if (/lipid/.test(blob)) testHint = 'lipid_profile';

  const { extractDiabetesEntities } = require('../diabetes/DiabetesIntelligenceEngine');
  const diabetesEntities = extractDiabetesEntities(blob);
  if (diabetesEntities.hasDiabetesContext) {
    if (diabetesEntities.hba1c_pct !== null) testHint = 'hba1c';
    else if (diabetesEntities.glucose_mg_dl !== null) testHint = 'fasting_blood_sugar';

    if (diabetesEntities.symptoms.neuropathy_foot.length > 0) {
      chiefComplaint = 'foot_wound';
      specialtyHint = 'Endocrinologist';
    } else if (diabetesEntities.symptoms.hypoglycemic.length > 0) {
      chiefComplaint = 'hypoglycemia';
      specialtyHint = 'Endocrinologist';
    } else if (diabetesEntities.symptoms.hyperglycemic.length > 0) {
      chiefComplaint = 'hyperglycemia';
      specialtyHint = 'Endocrinologist';
    } else if (!specialtyHint) {
      specialtyHint = 'Endocrinologist';
    }
  }

  const { extractMentalHealthEntities } = require('../mentalhealth/MentalHealthIntelligenceEngine');
  const mentalHealthEntities = extractMentalHealthEntities(blob);
  if (mentalHealthEntities.hasMentalHealthContext) {
    if (mentalHealthEntities.isPanicAttack) {
      chiefComplaint = 'panic_attack';
      specialtyHint = 'Clinical Psychologist';
    } else if (mentalHealthEntities.isDepression) {
      chiefComplaint = 'depression';
      specialtyHint = 'Psychiatrist';
    } else if (mentalHealthEntities.isAnxiety) {
      chiefComplaint = 'anxiety';
      specialtyHint = 'Clinical Psychologist';
    } else if (mentalHealthEntities.isInsomnia) {
      chiefComplaint = 'insomnia';
      specialtyHint = 'General Physician';
    }
  }

  return {
    chiefComplaint,
    durationHours,
    severityScale,
    associatedSymptoms: associated,
    bodySite,
    onset,
    requestedIntent,
    redFlagsDetected: [],
    pregnancyStatus: /pregnan/.test(blob) ? 'pregnant' : 'unknown',
    ageGroup: 'unknown',
    confidence: 0.55,
    specialtyHint,
    testHint,
    diabetesEntities: diabetesEntities.hasDiabetesContext ? diabetesEntities : undefined,
    mentalHealthEntities: mentalHealthEntities.hasMentalHealthContext ? mentalHealthEntities : undefined,
  };
}

/**
 * @param {string} message
 * @param {Record<string, string>} [answers]
 * @returns {Promise<{ extraction: object, source: 'llm'|'heuristic', error?: string }>}
 */
async function extractSymptoms(message, answers = {}) {
  const openai = getClient();
  if (!openai) {
    return {
      extraction: sanitizeExtractionAgainstSource(
        heuristicExtract(message, answers),
        message,
        answers,
      ),
      source: 'heuristic',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildExtractionUserPrompt(message, answers) },
      ],
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) {
      return {
        extraction: sanitizeExtractionAgainstSource(
          heuristicExtract(message, answers),
          message,
          answers,
        ),
        source: 'heuristic',
        error: 'empty_llm_response',
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      logger.warn('Copilot extraction JSON parse failed', { error: err.message });
      return {
        extraction: sanitizeExtractionAgainstSource(
          heuristicExtract(message, answers),
          message,
          answers,
        ),
        source: 'heuristic',
        error: 'invalid_json',
      };
    }

    const validated = validateExtraction(parsed);
    if (!validated.ok) {
      logger.warn('Copilot extraction schema failed', { error: validated.error });
      return {
        extraction: sanitizeExtractionAgainstSource(
          heuristicExtract(message, answers),
          message,
          answers,
        ),
        source: 'heuristic',
        error: 'schema_validation_failed',
      };
    }

    return {
      extraction: sanitizeExtractionAgainstSource(validated.data, message, answers),
      source: 'llm',
    };
  } catch (err) {
    logger.warn('Copilot extraction LLM failed', { error: err.message });
    return {
      extraction: sanitizeExtractionAgainstSource(
        heuristicExtract(message, answers),
        message,
        answers,
      ),
      source: 'heuristic',
      error: err.message || 'provider_error',
    };
  }
}

module.exports = {
  extractSymptoms,
  heuristicExtract,
  sanitizeExtractionAgainstSource,
};
