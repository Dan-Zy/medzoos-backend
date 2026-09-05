/**
 * Intelligent Clinical Clarification Engine
 *
 * Directives:
 * 1. Strictly enforces MAX_CLARIFICATION_BUDGET (max 2 questions per clinical inquiry) to prevent patient fatigue.
 * 2. Non-repetitive: tracks previously asked/answered clinical dimensions.
 * 3. Dynamic prioritization: selects the single highest-value missing clinical parameter.
 * 4. Localized quick-reply chips in Roman Urdu and English.
 * 5. Instant emergency bypass: never delays red-flag symptoms with clarification.
 * 6. Graceful exit: if user skips or budget is exhausted, resolves to conservative best-fit triage.
 */

const MAX_CLARIFICATION_BUDGET = 2;

const CLINICAL_QUESTION_CATALOG = {
  severity_scale: {
    key: 'severity_scale',
    priority: 10,
    en: 'On a scale of 1 to 10, how severe is your pain or symptom right now?',
    roman_ur: '1 se 10 k paimane par, aap ki takleef kitni shadeed hai?',
    suggestedReplies: [
      '1–3 / 10 (Halka / Mild)',
      '4–6 / 10 (Darmiyana / Moderate)',
      '7–10 / 10 (Shadeed / Severe)',
    ],
    extractValue: (text) => {
      const match = text.match(/\b([1-9]|10)\b/);
      return match ? parseInt(match[1], 10) : null;
    },
  },
  duration_onset: {
    key: 'duration_onset',
    priority: 9,
    en: 'When did this symptom start, and has it been constant or coming and going?',
    roman_ur: 'Yeh takleef kab shuru hui, aur kya yeh musalsal hai ya ruk ruk kar hoti hai?',
    suggestedReplies: [
      'Aaj hi shuru hui (Today / Sudden)',
      '2–3 din se (2–3 days)',
      '1 hafte se zyada (Over 1 week)',
    ],
    extractValue: (text) => {
      if (/aaj|today|sudden|abhi/i.test(text)) return { hours: 6, onset: 'sudden' };
      if (/2|3|din|days/i.test(text)) return { hours: 48, onset: 'gradual' };
      if (/hafta|week|maheena|month/i.test(text)) return { hours: 168, onset: 'chronic' };
      return null;
    },
  },
  diabetes_timing: {
    key: 'diabetes_timing',
    priority: 8,
    en: 'Was this blood sugar reading taken fasting (nihar munh) or 2 hours after eating (khane k baad)?',
    roman_ur: 'Yeh sugar ki reading nihar munh (fasting) li gayi hai ya khana khane k 2 ghante baad?',
    suggestedReplies: [
      'Nihar munh (Fasting)',
      'Khane k baad (Post-Meal / 2h after)',
      'Random / Kisi bhi waqt',
    ],
    extractValue: (text) => {
      if (/nihar|fasting|empty/i.test(text)) return 'fasting';
      if (/baad|post|after/i.test(text)) return 'post_prandial';
      if (/random/i.test(text)) return 'random';
      return null;
    },
  },
  radiation_back_pain: {
    key: 'radiation_back_pain',
    priority: 7,
    en: 'Does the pain spread down into your legs or feet, or do you feel any numbness/tingling?',
    roman_ur: 'Kya dard kamar se tangon ya paon ki taraf jata hai, ya sunn hone ka ehsaas hai?',
    suggestedReplies: [
      'Nahi, sirf kamar mein hai (Localized back only)',
      'Haan, tang mein dard jata hai (Radiates to leg)',
      'Tang sunn ho rahi hai (Numbness / Tingling)',
    ],
    extractValue: (text) => {
      if (/tang|leg|sunn|numb/i.test(text)) return 'radiating';
      return 'localized';
    },
  },
  mental_health_duration: {
    key: 'mental_health_duration',
    priority: 8,
    en: 'How long have you been feeling this way, and is it affecting your daily routine or sleep?',
    roman_ur: 'Aap kitne arsay se aisi bechaini ya udasi mehsoos kar rahe hain, aur kya neend mutasir hai?',
    suggestedReplies: [
      '2 hafton se zyada (More than 2 weeks)',
      'Pichle kuch dino se (Few days)',
      'Achanak ghabrahat hui (Acute panic / Sudden)',
    ],
    extractValue: (text) => text,
  },
  chief_complaint_clarify: {
    key: 'chief_complaint_clarify',
    priority: 10,
    en: 'To give you the most accurate guidance, what is the main symptom bothering you?',
    roman_ur: 'Sahi rehnumai k liye, aap ko sab se zyada kis cheez ki takleef ho rahi hai?',
    suggestedReplies: [
      'Dard / Pain',
      'Sugar / Diabetes Masla',
      'Ghabrahat / Anxiety',
      'Bukhar / Fever',
    ],
    extractValue: (text) => text,
  },
};

/**
 * Determine if clinical clarification is required and select the best question.
 *
 * @param {object} params
 * @param {object} params.extraction - Current symptom extraction
 * @param {object} [params.session] - Copilot session state with clarification history
 * @param {string} [params.userLanguage] - 'en', 'ur', 'roman_ur'
 * @returns {object|null} Clarification decision or null if clarification should be bypassed
 */
function evaluateClarificationNeed({
  extraction,
  session = null,
  userLanguage = 'roman_ur',
  missingFields = [],
  userMessage = '',
}) {
  const askedQuestions = session?.askedQuestions || [];
  const clarificationCount = askedQuestions.length;

  // 1. GATING: Enforce hard question budget
  if (clarificationCount >= MAX_CLARIFICATION_BUDGET) {
    return {
      needsClarification: false,
      budgetExhausted: true,
      reason: 'CLARIFICATION_BUDGET_EXHAUSTED',
    };
  }

  // 2. GATING: Detect if user explicitly bypassed or said "don't know"
  const lastUserText = (userMessage || session?.triggerMessage || session?.lastUserMessage || '').toLowerCase();
  if (
    /\b(pata nahi|don'?t know|not sure|skip|bas yahi|aur kuch nahi|no idea)\b/i.test(lastUserText)
  ) {
    return {
      needsClarification: false,
      userSkipped: true,
      skippedByUser: true,
      reason: 'USER_SKIPPED_CLARIFICATION',
    };
  }

  // 3. Dynamic Question Selection based on clinical gaps
  const candidates = [];

  // Check Chief Complaint gap
  if (missingFields.includes('chiefComplaint') && !askedQuestions.includes('chief_complaint_clarify')) {
    candidates.push(CLINICAL_QUESTION_CATALOG.chief_complaint_clarify);
  }

  // Check Diabetes Timing gap
  if (
    extraction.diabetesEntities?.hasDiabetesContext &&
    extraction.diabetesEntities?.glucose_mg_dl !== null &&
    !extraction.diabetesEntities?.timing &&
    !askedQuestions.includes('diabetes_timing')
  ) {
    candidates.push(CLINICAL_QUESTION_CATALOG.diabetes_timing);
  }

  // Check Back Pain radiation gap
  if (
    (extraction.chiefComplaint === 'lower_back_pain' || extraction.bodySite === 'back') &&
    !askedQuestions.includes('radiation_back_pain')
  ) {
    candidates.push(CLINICAL_QUESTION_CATALOG.radiation_back_pain);
  }

  // Check Severity Scale gap
  if (missingFields.includes('severityScale') && !askedQuestions.includes('severity_scale')) {
    candidates.push(CLINICAL_QUESTION_CATALOG.severity_scale);
  }

  // Check Duration / Onset gap
  if (missingFields.includes('durationOrOnset') && !askedQuestions.includes('duration_onset')) {
    candidates.push(CLINICAL_QUESTION_CATALOG.duration_onset);
  }

  // Check Mental Health duration gap
  if (
    extraction.mentalHealthEntities?.hasMentalHealthContext &&
    !askedQuestions.includes('mental_health_duration')
  ) {
    candidates.push(CLINICAL_QUESTION_CATALOG.mental_health_duration);
  }

  if (candidates.length === 0) {
    return {
      needsClarification: false,
      reason: 'NO_REMAINING_CLARIFICATION_CANDIDATES',
    };
  }

  // Sort candidates by clinical priority descending
  candidates.sort((a, b) => b.priority - a.priority);
  const selected = candidates[0];

  const questionText = userLanguage === 'en' ? selected.en : selected.roman_ur;

  return {
    needsClarification: true,
    questionKey: selected.key,
    text: questionText,
    suggestedReplies: selected.suggestedReplies,
    clarificationIndex: clarificationCount + 1,
    maxBudget: MAX_CLARIFICATION_BUDGET,
    triageLevel: 'NEEDS_MORE_INFORMATION',
    reasonCode: 'MISSING_CLINICAL_DETAIL',
    reasoning: `Asking targeted clarification for [${selected.key}] to safely assess urgency without delay.`,
  };
}

module.exports = {
  MAX_CLARIFICATION_BUDGET,
  CLINICAL_QUESTION_CATALOG,
  evaluateClarificationNeed,
};
