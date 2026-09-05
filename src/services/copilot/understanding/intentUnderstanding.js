/**
 * Soft intent understanding + polite clarify-when-unsure.
 * Works on English + Roman English after textNormalizer.
 *
 * High-confidence intents are returned for callers to route.
 * Low-confidence / unknown → polite bilingual clarification (never rude, never invent).
 */

const { normalizeText, detectUserLanguage } = require('../triage/textNormalizer');

function createId(prefix = 'action') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** @typedef {'emergency'|'symptoms'|'doctor'|'appointment'|'medicine'|'lab'|'report'|'exercise'|'product'|'capability'|'unknown'} SoftIntent */

/**
 * @param {string} message
 * @returns {{ intent: SoftIntent, confidence: number, language: 'en'|'roman_ur', normalized: string }}
 */
function understandMessage(message) {
  const language = detectUserLanguage(message);
  const normalized = normalizeText(message);
  const raw = String(message || '').toLowerCase();

  if (!normalized || normalized.length < 2) {
    return { intent: 'unknown', confidence: 0, language, normalized };
  }

  // Emergency — highest
  if (
    /\b(emergency|1122|ambulance|cannot breathe|unconscious|severe bleeding|behosh|khoon beh)\b/i.test(
      normalized,
    )
  ) {
    return { intent: 'emergency', confidence: 0.98, language, normalized };
  }

  // Product / competitor handled elsewhere — light hint only
  if (/\b(medzoos|marham|oladoc)\b/i.test(raw)) {
    return { intent: 'product', confidence: 0.9, language, normalized };
  }

  // Booking / capability
  if (
    /\b(can you book|help me book|book for me|appointment|how to book|kaise book|mere liye book)\b/i.test(
      normalized,
    ) ||
    (/\b(book|appointment)\b/i.test(normalized) &&
      /\b(kya|sakte|tum|aap|mere liye|doctor)\b/i.test(normalized))
  ) {
    return { intent: 'appointment', confidence: 0.88, language, normalized };
  }

  // Exercise
  if (/\b(exercise|stretch|workout|physio|mobility|yoga)\b/i.test(normalized)) {
    return { intent: 'exercise', confidence: 0.9, language, normalized };
  }

  // Lab / report
  if (/\b(lab report|explain.*report|test result|cbc|hba1c)\b/i.test(normalized)) {
    return { intent: 'report', confidence: 0.88, language, normalized };
  }
  if (/\b(lab test|blood test|book lab|home collection)\b/i.test(normalized)) {
    return { intent: 'lab', confidence: 0.88, language, normalized };
  }

  // Medicine
  if (
    /\b(medicine|medication|missed|refill|dawai|tablet|pill|dose)\b/i.test(normalized)
  ) {
    return { intent: 'medicine', confidence: 0.85, language, normalized };
  }

  // Doctor search (without booking capability phrasing)
  if (
    /\b(doctor|specialist|cardiolog|dermatolog|physician|hospital)\b/i.test(normalized) &&
    !/\b(pain|fever|cough|dizzy|vomit|takleef|dard|bukhar)\b/i.test(normalized)
  ) {
    return { intent: 'doctor', confidence: 0.82, language, normalized };
  }

  // Symptoms
  if (
    /\b(pain|fever|chest|headache|cough|dizzy|nausea|vomit|symptom|hurt|ache|breath|takleef|dard|bukhar|anxiety|depression|fatigue|cold|rash|bleeding)\b/i.test(
      normalized,
    )
  ) {
    return { intent: 'symptoms', confidence: 0.86, language, normalized };
  }

  // Very short / vague
  if (
    normalized.split(/\s+/).length <= 3 &&
    !/\b(hello|hi|salam|assalam|hey|ok|thanks|shukriya)\b/i.test(normalized)
  ) {
    return { intent: 'unknown', confidence: 0.25, language, normalized };
  }

  // Greetings — treat as soft unknown → invite help (polite)
  if (/^(hello|hi|hey|salam|assalamualaikum|assalam|aoa|hola)\b/i.test(normalized)) {
    return { intent: 'unknown', confidence: 0.4, language, normalized };
  }

  // No clear clinical/app bucket
  return { intent: 'unknown', confidence: 0.35, language, normalized };
}

function clarifyActions() {
  return [
    {
      id: createId(),
      type: 'book_doctor',
      label: 'Doctor / appointment',
      reason: 'Find and book a doctor in Medzoos.',
      priority: 90,
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'DoctorsList' },
      },
    },
    {
      id: createId(),
      type: 'book_lab',
      label: 'Lab test',
      reason: 'Book a lab test.',
      priority: 80,
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'LabTestsList' },
      },
    },
    {
      id: createId(),
      type: 'order_medicine',
      label: 'Medicines',
      reason: 'Browse or order medicines.',
      priority: 70,
      navigation: {
        tab: 'Health',
        screen: 'MedicinesList',
      },
    },
  ];
}

/**
 * Polite bilingual clarify when we do not understand.
 * @param {string} message
 * @param {'en'|'roman_ur'} language
 */
function buildPoliteClarify(message, language = 'roman_ur') {
  const roman = [
    'Ji, main madad ke liye yahan hoon — lekin abhi mujhe bilkul clear nahi mila ke aap kya chahte hain.',
    '',
    'Thora simple bata dein taake main sahi help kar sakoon:',
    '• Doctor / appointment book karni hai?',
    '• Koi takleef / symptom hai (jaise bukhar, dard)?',
    '• Dawai / medicine?',
    '• Lab test ya report?',
    '• Exercise / stretch?',
    '',
    'Neeche se choose karein, ya apne words mein likh dein — main carefully sununga.',
  ].join('\n');

  const en = [
    "I'm here to help — I just need a bit more clarity on what you need.",
    '',
    'Please tell me simply:',
    '• Book a doctor / appointment?',
    '• A symptom or health concern (fever, pain, etc.)?',
    '• Medicine help?',
    '• Lab test or report?',
    '• Exercise / stretch guidance?',
    '',
    'Pick an option below, or type in your own words — I’ll listen carefully.',
  ].join('\n');

  const text = language === 'en' ? `${en}\n\n${roman}` : `${roman}\n\n${en}`;

  return {
    text,
    triageLevel: 'NEEDS_MORE_INFORMATION',
    riskLevel: null,
    reasonCode: 'POLITE_INTENT_CLARIFY',
    emergency: false,
    actions: clarifyActions(),
    suggestedReplies: [
      'Doctor book karna hai',
      'Mujhe bukhar / dard hai',
      'Medicine chahiye',
      'Lab test book karni hai',
      'Exercise batain',
      'Kuch aur bataun',
    ],
    reasoning: 'Intent unclear — asking user politely for clearer need.',
    differentials: [],
    questionKey: 'intent_clarify',
    metadata: {
      protocol: 'intent_clarify',
      language,
      originalMessage: String(message || '').slice(0, 200),
    },
  };
}

/**
 * If understanding is weak, return polite clarify response; else null (continue pipeline).
 * @param {string} message
 * @returns {null | object}
 */
function tryHandleUnclearIntent(message) {
  const understanding = understandMessage(message);

  // Let specialized handlers / clinical triage own high-confidence buckets
  if (understanding.confidence >= 0.75 && understanding.intent !== 'unknown') {
    return null;
  }

  // Unknown or low confidence → polite clarify (do NOT invent clinical answers)
  if (understanding.intent === 'unknown' || understanding.confidence < 0.55) {
    return buildPoliteClarify(message, understanding.language);
  }

  return null;
}

module.exports = {
  understandMessage,
  tryHandleUnclearIntent,
  buildPoliteClarify,
  detectUserLanguage: (m) => detectUserLanguage(m),
};
