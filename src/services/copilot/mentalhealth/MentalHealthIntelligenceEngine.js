/**
 * Mental Health Clinical Intelligence Engine
 * Specialized extraction, crisis safety gating, and grounding protocols for Psychiatry & Mental Health.
 *
 * Implements:
 * - Immediate Suicide / Self-Harm Crisis Red Flags with Pakistan Helpline Routing (Umang, Rozan, 1122).
 * - Acute Panic Attack & Hyperventilation Grounding Protocol (Box Breathing 4-4-4-4, 5-4-3-2-1 Sensory Grounding).
 * - Depression & Anxiety Clinical Triage (PHQ-9 / GAD-7 Mapping & Specialty Referrals).
 * - Sleep Hygiene & Insomnia Protocols.
 * - Psychiatric Medication Safety (Strict Anti-Adjustment & Withdrawal Guardrails).
 */

const { normalizeText } = require('../triage/textNormalizer');

/**
 * Verified Mental Health Crisis Resources in Pakistan
 */
const PAKISTAN_CRISIS_HOTLINES = [
  {
    name: 'Umang Mental Health Helpline (24/7)',
    phone: '0311-7786264',
    alt: '0311-UMANG64',
    description: 'Free, confidential 24/7 mental health crisis support across Pakistan.',
  },
  {
    name: 'Rozan Counseling Helpline',
    phone: '0800-22444',
    alt: '0303-4442288',
    description: 'Toll-free psychological counseling and emotional support.',
  },
  {
    name: 'Taskeen Mental Health Helpline',
    phone: '0316-8275336',
    description: 'Free psychological counseling and support services.',
  },
  {
    name: 'Emergency Services (Rescue 1122)',
    phone: '1122',
    description: 'National emergency response for immediate physical safety.',
  },
];

/**
 * Common psychiatric & psychotropic medication lexicon
 */
const PSYCH_MEDICATIONS = [
  'escitalopram',
  'cipralex',
  'lexapro',
  'sertraline',
  'zoloft',
  'fluoxetine',
  'prozac',
  'paroxetine',
  'seroxat',
  'citalopram',
  'duloxetine',
  'cymbalta',
  'venlafaxine',
  'effexor',
  'mirtazapine',
  'remeron',
  'bupropion',
  'wellbutrin',
  'alprazolam',
  'xanax',
  'clonazepam',
  'rivotril',
  'lorazepam',
  'ativan',
  'diazepam',
  'valium',
  'bromazepam',
  'lexotanil',
  'quetiapine',
  'seroquel',
  'olanzapine',
  'zyprexa',
  'risperidone',
  'risperdal',
  'aripiprazole',
  'abilify',
];

/**
 * Extract mental health specific entities from text.
 * @param {string} text
 * @returns {object}
 */
function extractMentalHealthEntities(text) {
  if (!text || typeof text !== 'string') {
    return { hasMentalHealthContext: false };
  }

  const lower = text.toLowerCase();

  const entities = {
    hasMentalHealthContext: false,
    isCrisis: false,
    crisisType: null, // suicide_ideation | self_harm | acute_hopelessness
    isPanicAttack: false,
    isDepression: false,
    isAnxiety: false,
    isInsomnia: false,
    symptoms: {
      crisis: [],
      panic_anxiety: [],
      depression: [],
      sleep: [],
    },
    medications: [],
    medication_change_inquiry: false,
  };

  // 1. Crisis & Suicide / Self-Harm Detection
  const crisisPatterns = [
    /\b(suicide|suicidal|kill myself|end my life|ending my life|want to die|take my own life|feel like dying)\b/i,
    /\b(self harm|cutting myself|hurt myself|burn myself)\b/i,
    /\b(khudkushi|khud kushi|marne ka dil|mar jana chahta|zindagi khatam|zindagi se tang)\b/i,
    /\b(khud ko marna|apne aap ko nuqsan|apne ap ko khatam)\b/i,
    /\b(no reason to live|better off dead|koi faida nahi jeene ka)\b/i,
  ];

  for (const pattern of crisisPatterns) {
    if (pattern.test(lower)) {
      entities.hasMentalHealthContext = true;
      entities.isCrisis = true;
      entities.crisisType = 'suicide_ideation';
      entities.symptoms.crisis.push('suicide_self_harm_ideation');
      break;
    }
  }

  // 2. Panic Attack & Acute Anxiety Detection
  if (
    /\b(panic attack|panic|acute anxiety|hyperventilati)\b/i.test(lower) ||
    /\b(ghabrahat|ghabrahut|shadeed ghabrahat|dil ghabra raha|khauf)\b/i.test(lower) ||
    (/\b(dil ki dharkan tez|racing heart|palpitations|tachycardia)\b/i.test(lower) &&
      /\b(anxiety|dar|khauf|ghabrahat|sans phool)\b/i.test(lower))
  ) {
    entities.hasMentalHealthContext = true;
    entities.isPanicAttack = true;
    if (/\b(ghabrahat|anxiety)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('acute_anxiety');
    if (/\b(panic)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('panic_attack');
    if (/\b(dil ki dharkan|palpitations|racing heart)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('palpitations');
    if (/\b(sans phool|hyperventilat|shortness of breath)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('hyperventilation');
    if (/\b(dizziness|chakkar|lightheaded)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('dizziness');
    if (/\b(trembling|shaking|kapkapi)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('trembling');
  }

  // 3. Depression Symptom Detection
  if (
    /\b(depress|depression|clinical depression|major depression)\b/i.test(lower) ||
    /\b(udasi|har waqt udas|mayoosi|anhedonia)\b/i.test(lower) ||
    /dil\s+(?:nahi|na)\s+lag/i.test(lower) ||
    /\b(loss of interest|feeling empty|crying spells|rone ka dil)\b/i.test(lower)
  ) {
    entities.hasMentalHealthContext = true;
    entities.isDepression = true;
    if (/\b(udasi|sadness|depress)\b/i.test(lower)) entities.symptoms.depression.push('persistent_sadness');
    if (/dil\s+(?:nahi|na)\s+lag|loss of interest|anhedonia/i.test(lower)) entities.symptoms.depression.push('anhedonia');
    if (/\b(mayoosi|hopeless)\b/i.test(lower)) entities.symptoms.depression.push('hopelessness');
    if (/\b(rone ka dil|crying)\b/i.test(lower)) entities.symptoms.depression.push('crying_spells');
  }

  // 4. Generalized Anxiety & Overthinking
  if (
    /\b(anxiety|anxious|overthinking|worrying|generalized anxiety|gad)\b/i.test(lower) ||
    /\b(bechaini|sochon mein ghira|har waqt dar|zehni dabao|tension)\b/i.test(lower)
  ) {
    entities.hasMentalHealthContext = true;
    entities.isAnxiety = true;
    if (/\b(overthinking|sochon mein ghira)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('overthinking');
    if (/\b(bechaini|restless)\b/i.test(lower)) entities.symptoms.panic_anxiety.push('restlessness');
  }

  // 5. Sleep Disturbances / Insomnia
  if (
    /\b(insomnia|sleepless|cannot sleep|trouble sleeping|sleep problem)\b/i.test(lower) ||
    /\b(neend nahi aati|neend na aana|raat ko ankh khulna|neend ki kami)\b/i.test(lower)
  ) {
    entities.hasMentalHealthContext = true;
    entities.isInsomnia = true;
    entities.symptoms.sleep.push('insomnia');
  }

  // 6. Psych Medication Mentions & Safety Check
  for (const med of PSYCH_MEDICATIONS) {
    if (new RegExp(`\\b${med}\\b`, 'i').test(lower)) {
      entities.medications.push(med);
      entities.hasMentalHealthContext = true;
    }
  }

  if (
    entities.medications.length > 0 &&
    /\b(stop|chord|chhor|band kar|band kr|dose barha|dose kam|increase|decrease|withdraw|side effect)\b/i.test(lower)
  ) {
    entities.medication_change_inquiry = true;
  }

  return entities;
}

/**
 * Deterministic Clinical Triage Evaluator for Mental Health & Crisis Safety.
 *
 * @param {object} params
 * @param {object} params.entities - Extracted mental health entities
 * @param {string} params.userMessage
 * @param {object} [params.healthContext]
 * @returns {object|null} Evaluated clinical decision or null
 */
function evaluateMentalHealthTriage({ entities, userMessage, healthContext }) {
  if (!entities || !entities.hasMentalHealthContext) {
    return null;
  }

  // ——— Priority 1: Immediate Suicide / Self-Harm Crisis (Emergency) ———
  if (entities.isCrisis) {
    return {
      triggered: true,
      triageLevel: 'EMERGENCY',
      reasonCode: 'CRISIS_SUICIDE_SELF_HARM_RED_FLAG',
      reasoning: 'Critical mental health safety risk detected. Immediate empathetic de-escalation and helpline routing required.',
      text: 'You are not alone, and help is available right now. Please reach out to someone who can support you:\n\n• Umang Mental Health Helpline (24/7 Free): 0311-7786264\n• Rozan Counseling Helpline: 0800-22444 / 0303-4442288\n• Emergency Services: 1122\n\nIf you are in immediate physical danger, please call 1122 or go to the nearest hospital emergency room. Please stay safe — people care about you and want to help.',
      specialty: 'Psychiatry / Crisis Intervention',
      protocolId: 'crisis_suicide_prevention',
      actions: [
        {
          id: 'action_call_umang',
          type: 'call_emergency',
          label: 'Call Umang 24/7 (0311-7786264)',
          priority: 100,
          params: { phone: '03117786264' },
        },
        {
          id: 'action_call_1122',
          type: 'call_emergency',
          label: 'Call Emergency (1122)',
          priority: 95,
          params: { phone: '1122' },
        },
        {
          id: 'action_call_rozan',
          type: 'call_emergency',
          label: 'Call Rozan (0800-22444)',
          priority: 90,
          params: { phone: '080022444' },
        },
      ],
      suggestedReplies: [
        'I want to speak with a counselor',
        'Help me do a calming breathing exercise',
        'Find nearest emergency center',
      ],
      hotlines: PAKISTAN_CRISIS_HOTLINES,
    };
  }

  // ——— Priority 2: Psychiatric Medication Adjustment Safety Alert ———
  if (entities.medication_change_inquiry) {
    return {
      triggered: true,
      triageLevel: 'URGENT',
      reasonCode: 'PSYCHIATRIC_MEDICATION_SAFETY_ALERT',
      reasoning: 'Altering psychiatric medications (SSRIs/Benzodiazepines) abruptly can trigger dangerous discontinuation syndrome, rebound panic, or clinical relapse.',
      text: 'IMPORTANT SAFETY NOTICE: Never stop, reduce, or increase the dosage of psychiatric medications (such as antidepressants or anti-anxiety medicine) without direct medical supervision by your psychiatrist.\n\nAbrupt discontinuation can cause severe withdrawal symptoms, dizziness, electric shock sensations (brain zaps), and rebound anxiety. Please schedule a follow-up consultation with your doctor to adjust your treatment safely.',
      specialty: 'Psychiatrist',
      protocolId: 'psychiatric_medication_safety',
      actions: [
        {
          id: 'action_book_psychiatrist',
          type: 'follow_up',
          label: 'Consult Prescribing Psychiatrist',
          priority: 85,
        },
      ],
      suggestedReplies: [
        'What are antidepressant withdrawal symptoms?',
        'Book Psychiatrist consultation',
        'Talk about side effects',
      ],
    };
  }

  // ——— Priority 3: Acute Panic Attack & Hyperventilation Protocol ———
  if (entities.isPanicAttack) {
    return {
      triggered: true,
      triageLevel: 'SELF_CARE',
      reasonCode: 'PANIC_ATTACK_ACUTE',
      reasoning: 'Acute panic symptoms without cardiac red flags respond rapidly to autonomic nervous system regulation and grounding techniques.',
      text: 'You are experiencing symptoms of acute anxiety or a panic attack. While intense, panic attacks are temporary and will pass. Let\'s ground your nervous system right now:\n\n1. Box Breathing (4-4-4-4):\n• Breathe in slowly through your nose for 4 seconds\n• Hold your breath gently for 4 seconds\n• Exhale slowly through your mouth for 4 seconds\n• Hold empty for 4 seconds\n• Repeat 4 to 5 times.\n\n2. 5-4-3-2-1 Sensory Grounding:\n• 5 things you can SEE around you\n• 4 things you can physically TOUCH or FEEL\n• 3 things you can HEAR right now\n• 2 things you can SMELL\n• 1 thing you can TASTE',
      specialty: 'Clinical Psychologist / Psychiatrist',
      protocolId: 'panic_attack_grounding',
      actions: [
        {
          id: 'action_box_breathing',
          type: 'symptom_tracker',
          label: 'Start Box Breathing Guide',
          priority: 90,
        },
        {
          id: 'action_book_counselor',
          type: 'follow_up',
          label: 'Book Clinical Psychologist',
          priority: 75,
        },
      ],
      suggestedReplies: [
        'Guide me through Box Breathing step by step',
        'My heart is beating fast, is it safe?',
        'Book Psychologist session',
      ],
    };
  }

  // ——— Priority 4: Depression & Persistent Low Mood ———
  if (entities.isDepression) {
    return {
      triggered: true,
      triageLevel: 'ROUTINE',
      reasonCode: 'DEPRESSION_EVALUATION_ROUTINE',
      reasoning: 'Persistent depressive symptoms warrant standardized clinical screening (PHQ-9) and specialist consultation.',
      text: 'Experiencing persistent low mood, loss of interest, and fatigue can be a sign of depression. Clinical depression is a treatable medical condition. We recommend consulting a licensed clinical psychologist or psychiatrist for an evaluation and taking a standard PHQ-9 screening assessment.',
      specialty: 'Clinical Psychologist / Psychiatrist',
      protocolId: 'depression_screening',
      actions: [
        {
          id: 'action_book_therapist',
          type: 'follow_up',
          label: 'Consult Clinical Psychologist',
          priority: 80,
        },
        {
          id: 'action_phq9_screening',
          type: 'symptom_tracker',
          label: 'Take PHQ-9 Assessment',
          priority: 75,
        },
      ],
      suggestedReplies: [
        'Take PHQ-9 Depression test',
        'Find Clinical Psychologist near me',
        'Daily habits to cope with low mood',
      ],
    };
  }

  // ——— Priority 5: Generalized Anxiety & Chronic Worry ———
  if (entities.isAnxiety) {
    return {
      triggered: true,
      triageLevel: 'ROUTINE',
      reasonCode: 'ANXIETY_EVALUATION_ROUTINE',
      reasoning: 'Chronic worry and autonomic tension benefit from structured psychological counseling (CBT) and GAD-7 screening.',
      text: 'Frequent worry, restlessness, and overthinking can be managed effectively with evidence-based cognitive behavioral techniques (CBT), progressive muscle relaxation, and specialist guidance.',
      specialty: 'Clinical Psychologist',
      protocolId: 'anxiety_screening',
      actions: [
        {
          id: 'action_book_counselor',
          type: 'follow_up',
          label: 'Book Counseling Session',
          priority: 80,
        },
      ],
      suggestedReplies: [
        'What is GAD-7 Anxiety screening?',
        'Techniques to stop overthinking',
        'Book therapy session',
      ],
    };
  }

  // ——— Priority 6: Sleep Difficulties & Insomnia ———
  if (entities.isInsomnia) {
    return {
      triggered: true,
      triageLevel: 'SELF_CARE',
      reasonCode: 'INSOMNIA_SLEEP_HYGIENE',
      reasoning: 'Insomnia without major depressive episodes responds well to standard sleep hygiene and stimulus control.',
      text: 'Sleep Hygiene Recommendations:\n• Maintain a consistent sleep-wake schedule, even on weekends.\n• Avoid caffeine, heavy meals, and nicotine 6 hours before bedtime.\n• Turn off smartphone and TV screens at least 45 minutes before sleep.\n• Keep your bedroom quiet, dark, and comfortably cool.',
      specialty: 'General Physician / Sleep Specialist',
      protocolId: 'insomnia_sleep_hygiene',
      actions: [
        {
          id: 'action_sleep_guide',
          type: 'symptom_tracker',
          label: 'View Sleep Hygiene Checklist',
          priority: 60,
        },
      ],
      suggestedReplies: [
        'Natural ways to fall asleep faster',
        'How does blue light affect sleep?',
        'Consult a doctor about sleep',
      ],
    };
  }

  return null;
}

module.exports = {
  extractMentalHealthEntities,
  evaluateMentalHealthTriage,
  PAKISTAN_CRISIS_HOTLINES,
  PSYCH_MEDICATIONS,
};
