/**
 * Diabetes Clinical Intelligence Engine
 * Specialized extraction and deterministic triage gating for diabetes & metabolic health.
 *
 * Implements:
 * - Roman Urdu & English entity extraction (Glucose mg/dL / mmol/L, HbA1c %, Ketones, Meds, Symptoms).
 * - Hypoglycemia 15-15 Rule gating & Severe Hypoglycemia Red Flags.
 * - DKA / HHS crisis detection (Glucose > 300 mg/dL + vomiting/acidosis/ketones).
 * - Ramadan Fasting Risk Stratification (IDF-DAR Guidelines).
 * - Diabetic foot & neuropathy safety protocols.
 */

const { normalizeText } = require('../triage/textNormalizer');

/**
 * Common diabetes medication lexicon (generic & Pakistani brand names)
 */
const DIABETES_MEDICATIONS = [
  'metformin',
  'glucophage',
  'glimepiride',
  'amaryl',
  'glibenclamide',
  'daonil',
  'gliclazide',
  'diamicron',
  'sitagliptin',
  'januvia',
  'vildagliptin',
  'galvus',
  'linagliptin',
  'trajenta',
  'empagliflozin',
  'jardiance',
  'dapagliflozin',
  'forxiga',
  'canagliflozin',
  'invokana',
  'semaglutide',
  'ozempic',
  'rybelsus',
  'liraglutide',
  'victoza',
  'insulin',
  'lantus',
  'novorapid',
  'humalog',
  'mixtard',
  'tresiba',
  'levemir',
  'soliqua',
  'xultophy',
];

/**
 * Extract diabetes-specific entities from text.
 * @param {string} text
 * @returns {object}
 */
function extractDiabetesEntities(text) {
  if (!text || typeof text !== 'string') {
    return { hasDiabetesContext: false };
  }

  const normalized = normalizeText(text);
  const lower = text.toLowerCase();

  const entities = {
    hasDiabetesContext: false,
    glucose_mg_dl: null,
    glucose_mmol_l: null,
    glucose_raw: null,
    glucose_unit: null,
    timing: 'unknown', // fasting | postprandial | random | bedtime
    hba1c_pct: null,
    ketones: null,
    medications: [],
    symptoms: {
      hypoglycemic: [],
      hyperglycemic: [],
      dka_acidosis: [],
      neuropathy_foot: [],
    },
    fasting_intent: false, // Ramadan or clinical fasting
    altered_consciousness: false,
  };

  // 1. Check general diabetes mention
  if (
    /\b(diabetes|sugar|diabetic|ziyabetis|hba1c|a1c|insulin|glucophage|amaryl|jardiance|galvus|januvia)\b/i.test(
      lower
    ) ||
    /\b(nihar munh|niharmon|khane k baad|3 month wali sugar|sugar gir|sugar kam|sugar barh)\b/i.test(
      lower
    ) ||
    /\b(foot ulcer|foot wound|paon mein zakham|diabetic foot|sunn hona)\b/i.test(
      lower
    )
  ) {
    entities.hasDiabetesContext = true;
  }

  // 2. Extract Timing Context
  if (/\b(fasting sugar|fasting glucose|nihar munh|niharmon|subah khali pet|khali pait|before breakfast)\b/i.test(lower)) {
    entities.timing = 'fasting';
    entities.hasDiabetesContext = true;
  } else if (
    /\b(postprandial|post_prandial|khane k baad|khane ke baad|after meal|after lunch|after dinner|2 hours after)\b/i.test(
      lower
    )
  ) {
    entities.timing = 'postprandial';
    entities.hasDiabetesContext = true;
  } else if (/\b(bedtime|raat ko sote waqt|sotay waqt)\b/i.test(lower)) {
    entities.timing = 'bedtime';
    entities.hasDiabetesContext = true;
  } else if (/\b(random|kisi bhi waqt|din mein)\b/i.test(lower)) {
    entities.timing = 'random';
  }

  // 3. Extract Blood Glucose Reading
  // Patterns: "sugar 55", "sugar is 280 mg/dl", "glucose 3.5 mmol", "nihar munh 140", "sugar 6.2"
  const mmolMatch = lower.match(
    /(?:sugar|glucose|level|reading)?\s*(?:is|=|:)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:mmol(?:\/l)?)/i
  );
  const mgdlMatch = lower.match(
    /(?:sugar|glucose|level|reading)?\s*(?:is|=|:)?\s*(\d{2,3})\s*(?:mg(?:\/dl)?)/i
  );
  const generalSugarMatch = lower.match(
    /(?:sugar|glucose|reading|level|nihar munh|fasting sugar|fasting|khane k baad)\s*(?:aayi hai|hai|is|=|:)?\s*(\d{2,3}(?:\.\d{1,2})?)/i
  );
  const standaloneSugarMatch = lower.match(/\b(?:sugar|glucose)\s+(\d{2,3})\b/i);

  if (mmolMatch) {
    const mmolVal = parseFloat(mmolMatch[1]);
    entities.glucose_mmol_l = mmolVal;
    entities.glucose_mg_dl = Math.round(mmolVal * 18.018);
    entities.glucose_raw = mmolMatch[1];
    entities.glucose_unit = 'mmol/L';
    entities.hasDiabetesContext = true;
  } else if (mgdlMatch) {
    entities.glucose_mg_dl = parseInt(mgdlMatch[1], 10);
    entities.glucose_raw = mgdlMatch[1];
    entities.glucose_unit = 'mg/dL';
    entities.hasDiabetesContext = true;
  } else if (generalSugarMatch) {
    const rawVal = parseFloat(generalSugarMatch[1]);
    if (rawVal < 30) {
      // mmol/L assumed for small floats
      entities.glucose_mmol_l = rawVal;
      entities.glucose_mg_dl = Math.round(rawVal * 18.018);
      entities.glucose_unit = 'mmol/L';
    } else {
      entities.glucose_mg_dl = Math.round(rawVal);
      entities.glucose_unit = 'mg/dL';
    }
    entities.glucose_raw = generalSugarMatch[1];
    entities.hasDiabetesContext = true;
  } else if (standaloneSugarMatch) {
    entities.glucose_mg_dl = parseInt(standaloneSugarMatch[1], 10);
    entities.glucose_raw = standaloneSugarMatch[1];
    entities.glucose_unit = 'mg/dL';
    entities.hasDiabetesContext = true;
  }

  // 4. Extract HbA1c Reading
  const hba1cMatch = lower.match(
    /(?:hba1c|a1c|3\s*month\s*wali\s*sugar|3\s*mahinay\s*ki\s*sugar|teen\s*maheene\s*ki\s*sugar)(?:[^\d%]{0,50})?(\d{1,2}(?:\.\d{1,2})?)\s*%/i
  ) || lower.match(
    /(?:hba1c|a1c|3\s*month\s*wali\s*sugar|3\s*mahinay\s*ki\s*sugar|teen\s*maheene\s*ki\s*sugar)\s*(?:is|=|:|hai)?\s*(\d{1,2}(?:\.\d{1,2})?)/i
  );
  if (hba1cMatch) {
    const val = parseFloat(hba1cMatch[1]);
    if (val >= 3.0 && val <= 20.0) {
      entities.hba1c_pct = val;
      entities.hasDiabetesContext = true;
    }
  }

  // 5. Extract Ketones
  if (/\b(ketones?\s*(?:positive|\+|present|large|moderate|high)|peshab mein ketone)\b/i.test(lower)) {
    entities.ketones = 'positive';
    entities.hasDiabetesContext = true;
  } else if (/\b(ketones?\s*(?:negative|-|absent|zero|nil))\b/i.test(lower)) {
    entities.ketones = 'negative';
    entities.hasDiabetesContext = true;
  }

  // 6. Extract Medications
  for (const med of DIABETES_MEDICATIONS) {
    if (new RegExp(`\\b${med}\\b`, 'i').test(lower)) {
      entities.medications.push(med);
      entities.hasDiabetesContext = true;
    }
  }

  // 7. Extract Symptoms
  // Hypoglycemia symptoms
  if (/\b(kapkapi|trembling|shaking|shaky|tremors?)\b/i.test(lower)) {
    entities.symptoms.hypoglycemic.push('trembling');
  }
  if (/\b(paseena|paseene|sweating|cold sweat|tar paseene)\b/i.test(lower)) {
    entities.symptoms.hypoglycemic.push('sweating');
  }
  if (/\b(chakkar|dizziness|lightheaded|sir ghumna)\b/i.test(lower)) {
    entities.symptoms.hypoglycemic.push('dizziness');
  }
  if (/\b(bhook|extreme hunger|shadeed bhook)\b/i.test(lower)) {
    entities.symptoms.hypoglycemic.push('hunger');
  }
  if (/\b(dil ki dharkan|palpitations|racing heart)\b/i.test(lower)) {
    entities.symptoms.hypoglycemic.push('palpitations');
  }

  // Altered consciousness / severe hypo red flags
  if (/\b(behosh|behoshi|unconscious|fainted|passed out|ghunoodgi|severe confusion|seizure)\b/i.test(lower)) {
    entities.altered_consciousness = true;
    entities.symptoms.hypoglycemic.push('altered_consciousness');
  }

  // Hyperglycemia symptoms
  if (/\b(bar bar peshab|frequent urination|polyuria|peshab ziyada)\b/i.test(lower)) {
    entities.symptoms.hyperglycemic.push('frequent_urination');
  }
  if (/\b(shadeed pyas|excessive thirst|polydipsia|pyas lagna)\b/i.test(lower)) {
    entities.symptoms.hyperglycemic.push('excessive_thirst');
  }
  if (/\b(dhundla dikhna|blurred vision|nazar kamzor)\b/i.test(lower)) {
    entities.symptoms.hyperglycemic.push('blurred_vision');
  }
  if (/\b(thakawat|extreme fatigue|kamzori)\b/i.test(lower)) {
    entities.symptoms.hyperglycemic.push('fatigue');
  }

  // DKA / Acidosis symptoms
  if (/\b(ulti|vomiting|matli|nausea|vomit)\b/i.test(lower)) {
    entities.symptoms.dka_acidosis.push('vomiting');
  }
  if (/\b(pait mein dard|abdominal pain|stomach pain|pait dard)\b/i.test(lower)) {
    entities.symptoms.dka_acidosis.push('abdominal_pain');
  }
  if (/\b(tezi se sans|rapid breathing|deep breathing|kussmaul)\b/i.test(lower)) {
    entities.symptoms.dka_acidosis.push('rapid_breathing');
  }
  if (/\b(meethi boo|fruity breath|acetone smell)\b/i.test(lower)) {
    entities.symptoms.dka_acidosis.push('fruity_breath');
  }

  // Diabetic foot / Neuropathy symptoms
  if (
    /\b(foot ulcer|foot wound|zakham theek nahi|non healing wound|peep|pus)\b/i.test(lower) ||
    (/\b(zakham|wound|chala|blister|peep|pus)\b/i.test(lower) && /\b(paon|foot|feet|angootha|angoothe|toe|heel|talo)\b/i.test(lower))
  ) {
    entities.symptoms.neuropathy_foot.push('foot_ulcer');
    entities.hasDiabetesContext = true;
  }
  if (/\b(sunn|sunn hona|numbness|tingling|sooiyan chubhna|burning feet|jalan paon)\b/i.test(lower)) {
    entities.symptoms.neuropathy_foot.push('neuropathy_numbness');
    entities.hasDiabetesContext = true;
  }
  if (/\b(paon kala|black toe|discoloration|gangrene)\b/i.test(lower)) {
    entities.symptoms.neuropathy_foot.push('black_toe_gangrene');
    entities.hasDiabetesContext = true;
  }

  // 8. Ramadan Fasting Inquiry (only religious / intermittent fast, not medical fasting blood sugar)
  if (/\b(roza|roze|ramadan|ramzan|sehri|iftar|intermittent fasting)\b/i.test(lower)) {
    entities.fasting_intent = true;
    entities.hasDiabetesContext = true;
  }

  return entities;
}

/**
 * Deterministic Clinical Triage Evaluator for Diabetes.
 *
 * @param {object} params
 * @param {object} params.entities - Extracted diabetes entities
 * @param {string} params.userMessage
 * @param {object} [params.healthContext]
 * @returns {object|null} Evaluated clinical decision or null if not diabetes-specific
 */
function evaluateDiabetesTriage({ entities, userMessage, healthContext }) {
  if (!entities || !entities.hasDiabetesContext) {
    return null;
  }

  const glucose = entities.glucose_mg_dl;
  const hasKetones = entities.ketones === 'positive';
  const hasDkaSigns = entities.symptoms.dka_acidosis.length > 0;
  const isUnconscious = entities.altered_consciousness;
  const hasHypoSymptoms = entities.symptoms.hypoglycemic.length > 0;
  const hasFootUlcer = entities.symptoms.neuropathy_foot.includes('foot_ulcer') || entities.symptoms.neuropathy_foot.includes('black_toe_gangrene');

  // ——— Priority 1: Severe Hypoglycemia Red Flag (Emergency) ———
  // Glucose < 54 mg/dL OR Glucose < 70 mg/dL with altered consciousness/behoshi
  if ((glucose !== null && glucose < 54) || (glucose !== null && glucose < 70 && isUnconscious) || (isUnconscious && hasHypoSymptoms)) {
    return {
      triggered: true,
      triageLevel: 'EMERGENCY',
      reasonCode: 'SEVERE_HYPOGLYCEMIA_EMERGENCY',
      reasoning: 'Critical low blood glucose (<54 mg/dL or severe hypoglycemia with altered consciousness) is a medical emergency requiring immediate fast-acting carbohydrates or emergency medical services (1122) if unrousable.',
      text: 'EMERGENCY: Your blood glucose level is dangerously low (<54 mg/dL or hypoglycemia with severe neurological symptoms). If the person is conscious and able to swallow, give 15g fast-acting sugar (e.g. 1/2 glass fruit juice or 3-4 candies) immediately. If unconscious or unable to swallow, DO NOT put liquids in the mouth — call Emergency Services (1122) immediately.',
      specialty: 'Endocrinology / Emergency Medicine',
      protocolId: 'hypoglycemia_severe',
      actions: [
        {
          id: 'action_call_1122',
          type: 'call_emergency',
          label: 'Call Emergency (1122)',
          priority: 100,
          params: { phone: '1122' },
        },
        {
          id: 'action_15_15',
          type: 'symptom_tracker',
          label: '15-15 Fast-Acting Sugar Protocol',
          priority: 90,
        },
      ],
      suggestedReplies: [
        'How to give 15g fast sugar?',
        'When to re-check sugar?',
        'Patient is unconscious',
      ],
    };
  }

  // ——— Priority 2: Suspected DKA / Hyperglycemic Crisis (Emergency) ———
  // Glucose > 300 mg/dL with DKA signs (vomiting, abdominal pain, ketones)
  if ((glucose !== null && glucose >= 300 && (hasDkaSigns || hasKetones)) || (hasKetones && hasDkaSigns)) {
    return {
      triggered: true,
      triageLevel: 'EMERGENCY',
      reasonCode: 'DKA_HHS_CRISIS_EMERGENCY',
      reasoning: 'Marked hyperglycemia (>300 mg/dL) combined with metabolic acidosis symptoms (vomiting, abdominal pain, or positive ketones) strongly indicates suspected Diabetic Ketoacidosis (DKA) or Hyperosmolar Hyperglycemic State (HHS).',
      text: 'EMERGENCY: Your symptoms and high glucose readings indicate a risk of Diabetic Ketoacidosis (DKA) or Hyperglycemic Crisis. This requires immediate emergency medical evaluation, IV hydration, and physician care. Go to the nearest emergency department immediately.',
      specialty: 'Endocrinology / Emergency Medicine',
      protocolId: 'dka_crisis',
      actions: [
        {
          id: 'action_er',
          type: 'find_emergency_room',
          label: 'Go to Nearest Hospital ER',
          priority: 100,
        },
        {
          id: 'action_call_er',
          type: 'call_emergency',
          label: 'Call 1122',
          priority: 95,
        },
      ],
      suggestedReplies: [
        'What are DKA symptoms?',
        'Nearest Emergency Hospital',
      ],
    };
  }

  // ——— Priority 3: Mild-to-Moderate Hypoglycemia (Urgent 15-15 Rule) ———
  // Glucose 54 - 69 mg/dL without loss of consciousness
  if ((glucose !== null && glucose >= 54 && glucose < 70) || (hasHypoSymptoms && glucose === null && !isUnconscious)) {
    return {
      triggered: true,
      triageLevel: 'URGENT',
      reasonCode: 'HYPOGLYCEMIA_15_15_RULE',
      reasoning: 'Blood glucose is between 54–69 mg/dL or symptomatic hypoglycemia is present. Requires immediate execution of the clinical 15-15 Rule.',
      text: 'Your blood sugar is low (hypoglycemia). Follow the 15-15 Rule now:\n1. Consume 15g of fast-acting carbohydrate (e.g. 1/2 cup fruit juice, 3-4 sugar candies, or 1 tablespoon honey).\n2. Wait 15 minutes and re-check your blood sugar.\n3. If still below 70 mg/dL, repeat with another 15g. Once above 70 mg/dL, eat a small snack or meal.',
      specialty: 'Endocrinology / Diabetes',
      protocolId: 'hypoglycemia_mild_moderate',
      actions: [
        {
          id: 'action_hypo_rule',
          type: 'symptom_tracker',
          label: 'Follow 15-15 Rule',
          priority: 90,
        },
        {
          id: 'action_doctor_followup',
          type: 'follow_up',
          label: 'Consult Diabetologist',
          priority: 80,
        },
      ],
      suggestedReplies: [
        'Sugar is still below 70 after 15 min',
        'What causes low sugar?',
        'Book Diabetologist appointment',
      ],
    };
  }

  // ——— Priority 4: Diabetic Foot Ulcer / Severe Neuropathy Complication (Urgent) ———
  if (hasFootUlcer) {
    return {
      triggered: true,
      triageLevel: 'URGENT',
      reasonCode: 'HIGH_RISK_DIABETIC_FOOT',
      reasoning: 'Diabetic foot ulcer or tissue discoloration carries a high risk of deep tissue infection, osteomyelitis, and rapid progression.',
      text: 'A non-healing wound, sore, or color change on a diabetic patient\'s foot requires prompt professional clinical assessment. Keep the area clean, avoid walking barefoot or bearing pressure on the wound, and see an endocrinologist or diabetic foot specialist promptly.',
      specialty: 'Endocrinology / Diabetic Foot Care',
      protocolId: 'diabetic_foot',
      actions: [
        {
          id: 'action_book_foot_specialist',
          type: 'follow_up',
          label: 'Book Specialist Consultation',
          priority: 85,
        },
      ],
      suggestedReplies: [
        'How to clean diabetic foot wound?',
        'Find Diabetes Specialist nearby',
      ],
    };
  }

  // ——— Priority 5: Ramadan Fasting Risk Assessment (IDF-DAR Guidelines) ———
  if (entities.fasting_intent) {
    const isHighRisk =
      (glucose !== null && glucose > 250) ||
      (entities.hba1c_pct !== null && entities.hba1c_pct > 9.0) ||
      entities.medications.includes('insulin');
    return {
      triggered: true,
      triageLevel: isHighRisk ? 'ROUTINE' : 'SELF_CARE',
      reasonCode: 'RAMADAN_FASTING_DIABETES_ASSESSMENT',
      reasoning: 'Evaluation of fasting safety according to International Diabetes Federation & Diabetes and Ramadan (IDF-DAR) guidelines.',
      text: isHighRisk
        ? 'According to IDF-DAR clinical guidelines, fasting with elevated blood sugar or complex insulin regimens carries a high risk of hypoglycemia and dehydration. A pre-Ramadan medical assessment with your doctor is strongly advised before attempting to fast.'
        : 'For patients with well-controlled diabetes considering fasting during Ramadan, clinical guidelines recommend: checking blood glucose at Suhoor, midday, and Iftar; breaking the fast immediately if glucose drops below 70 mg/dL or exceeds 300 mg/dL; and adjusting medication timing with your doctor.',
      specialty: 'Endocrinology / Diabetes',
      protocolId: 'diabetes_ramadan_fasting',
      actions: [
        {
          id: 'action_pre_ramadan_doctor',
          type: 'follow_up',
          label: 'Pre-Ramadan Doctor Consultation',
          priority: 70,
        },
      ],
      suggestedReplies: [
        'When must I break my fast?',
        'How to adjust medicine at Sehri and Iftar?',
        'What foods are best for Sehri?',
      ],
    };
  }

  // ——— Priority 6: Severe Hyperglycemia without acute DKA flags (Urgent) ———
  // Glucose > 250 mg/dL
  if (glucose !== null && glucose >= 250) {
    return {
      triggered: true,
      triageLevel: 'URGENT',
      reasonCode: 'SEVERE_HYPERGLYCEMIA_URGENT',
      reasoning: 'Blood glucose is significantly elevated (>= 250 mg/dL). Requires urgent medical evaluation, hydration, and treatment adjustment.',
      text: 'Your blood glucose reading is significantly elevated. Drink plenty of water to prevent dehydration and avoid high-carbohydrate meals. Please consult your physician or diabetologist promptly to review your insulin or medication dosages.',
      specialty: 'Endocrinology / Internal Medicine',
      protocolId: 'hyperglycemia_severe',
      actions: [
        {
          id: 'action_book_doctor',
          type: 'follow_up',
          label: 'Consult Diabetologist',
          priority: 80,
        },
        {
          id: 'action_book_hba1c',
          type: 'pharmacy',
          label: 'Book HbA1c & Urine Test',
          priority: 75,
        },
      ],
      suggestedReplies: [
        'Why did my sugar spike?',
        'How much water to drink?',
        'Book doctor appointment',
      ],
    };
  }

  // ——— Priority 7: Routine Diabetes Monitoring & Glycemic Education ———
  return {
    triggered: true,
    triageLevel: 'SELF_CARE',
    reasonCode: 'DIABETES_ROUTINE_MONITORING',
    reasoning: 'Standard glycemic targets and diabetes lifestyle education.',
    text: 'Standard clinical targets for adults with diabetes (ADA guidelines):\n• Fasting blood glucose: 80–130 mg/dL (4.4–7.2 mmol/L)\n• Postprandial (1–2h after meals): < 180 mg/dL (< 10.0 mmol/L)\n• HbA1c target: < 7.0% for most nonpregnant adults.\nIndividual targets may vary based on your age and health history.',
    specialty: 'Endocrinology / Diabetes Education',
    protocolId: 'diabetes_routine_monitoring',
    actions: [
      {
        id: 'action_book_hba1c',
        type: 'pharmacy',
        label: 'Book HbA1c Test',
        priority: 60,
      },
    ],
    suggestedReplies: [
      'What is normal fasting sugar?',
      'How to lower HbA1c naturally?',
      'Book Diabetologist consultation',
    ],
  };
}

module.exports = {
  extractDiabetesEntities,
  evaluateDiabetesTriage,
  DIABETES_MEDICATIONS,
};
