/**
 * Mental Health Medical Taxonomy & Multilingual Term Catalog
 * Centralized, server-validated taxonomy for Mental Health & Psychiatry.
 * 
 * Safety Rule: The Copilot does NOT diagnose psychiatric disorders.
 * It provides psychoeducation, evidence-based coping skills, and safety routing.
 */

const MENTAL_HEALTH_TOPICS = {
  anxiety: {
    name: 'anxiety',
    title: 'Anxiety & Excessive Worry',
    description: 'Understanding generalized anxiety, somatic tension, overthinking, and management strategies.',
    subtopics: ['generalized_anxiety', 'somatic_symptoms', 'overthinking', 'worry_management', 'relaxation_techniques'],
    synonyms: [
      'anxiety', 'ghabrahat', 'bechaini', 'har waqt darr', 'tension',
      'overthinking', 'dil ki dharkan tez hona', 'hath paon kampna tension',
      'anxiety attack', 'excessive worry', 'restlessness'
    ]
  },
  stress: {
    name: 'stress',
    title: 'Stress & Burnout Management',
    description: 'Work, life, caregiver stress, burnout, emotional exhaustion, and resilience.',
    subtopics: ['acute_stress', 'chronic_stress', 'caregiver_burnout', 'workplace_stress', 'stress_reduction'],
    synonyms: [
      'stress', 'zehni dabao', 'dimaghi thakan', 'burnout', 'mental pressure',
      'work stress', 'dimagh par bojh', 'zehni thakan'
    ]
  },
  panic: {
    name: 'panic',
    title: 'Panic & Sudden Intense Fear',
    description: 'Recognizing panic attacks, hyperventilation, somatic surges, and ground-level calming steps.',
    subtopics: ['panic_attack_symptoms', 'hyperventilation', 'grounding_during_panic', 'post_panic_recovery'],
    synonyms: [
      'panic attack', 'achanak ghabrahat', 'dam ghutna panic',
      'sudden intense fear', 'dil doobna', 'chhat par se girne ka ehsas',
      'panic symptoms', 'heart racing suddenly fear'
    ]
  },
  mood: {
    name: 'mood',
    title: 'Mood Fluctuations & Regulation',
    description: 'Understanding mood changes, emotional dysregulation, and tracking patterns.',
    subtopics: ['mood_swings', 'irritability', 'emotional_lability', 'mood_tracking'],
    synonyms: [
      'mood swings', 'mood kharab rehna', 'ghussa jaldi aana',
      'irritability', 'mood changes', 'jazbaati tabdeeli'
    ]
  },
  depression_related_symptoms: {
    name: 'depression_related_symptoms',
    title: 'Depressive Symptoms & Low Mood Education',
    description: 'Recognizing persistent low mood, loss of interest (anhedonia), low energy, and seeking professional evaluation.',
    subtopics: ['low_mood', 'anhedonia_loss_of_interest', 'fatigue_low_energy', 'hopelessness', 'when_to_see_specialist'],
    synonyms: [
      'depression', 'udaasi', 'dil nahi lagta', 'mayoosi', 'rona aana',
      'kisi cheez mein dil na lagna', 'loss of interest', 'himmat tootna',
      'persistent sadness', 'depression k lakshan'
    ]
  },
  sleep: {
    name: 'sleep',
    title: 'Sleep Health & Insomnia Education',
    description: 'Evidence-based sleep hygiene, bedtime routines, stimulus control, and sleep tracking.',
    subtopics: ['sleep_hygiene', 'insomnia_patterns', 'bedtime_routine', 'circadian_rhythm', 'screen_hygiene'],
    synonyms: [
      'insomnia', 'neend nahi aati', 'neend ka masla', 'sleeping problem',
      'raat ko jagna', 'neend bar bar tootna', 'sleep hygiene tips',
      'how to sleep fast', 'pur sukoon neend'
    ]
  },
  emotional_support: {
    name: 'emotional_support',
    title: 'Emotional Well-Being & Support',
    description: 'Navigating grief, loss, relationship transitions, loneliness, and emotional validation.',
    subtopics: ['grief_and_loss', 'loneliness', 'relationship_stress', 'validation_and_listening'],
    synonyms: [
      'emotional support', 'grief', 'kisi ki wafaat par dukh', 'lonely feel karna',
      'tanhaai', 'dil halka karna', 'baat share karna'
    ]
  },
  therapy: {
    name: 'therapy',
    title: 'Psychotherapy & Counseling Education',
    description: 'Overview of Cognitive Behavioral Therapy (CBT), talk therapy, counseling modalities, and what to expect.',
    subtopics: ['cbt_overview', 'what_to_expect_therapy', 'finding_therapist', 'counseling_vs_psychiatry'],
    synonyms: [
      'therapy', 'counseling', 'psychologist', 'talk therapy', 'cbt therapy',
      'therapist se baat', 'counselor se rabta', 'psychotherapy kya hoti hai'
    ]
  },
  psychiatry: {
    name: 'psychiatry',
    title: 'Psychiatric Care & Specialist Referral',
    description: 'When and how to consult a psychiatrist, clinical evaluations, and integrated care.',
    subtopics: ['when_to_see_psychiatrist', 'psychiatric_assessment', 'specialist_referral', 'doctor_consultation'],
    synonyms: [
      'psychiatrist', 'dimagh ka doctor', 'mental health doctor',
      'psychiatrist se milna', 'psychiatric evaluation', 'medical doctor for mental health'
    ]
  },
  medications: {
    name: 'medications',
    title: 'Psychiatric Medications (Educational Overview)',
    description: 'General education on classes (SSRIs, SNRIs), adherence, non-sudden discontinuation, and doctor oversight.',
    subtopics: ['ssri_snri_overview', 'adherence_importance', 'side_effects_awareness', 'discontinuation_safety'],
    synonyms: [
      'antidepressants', 'anxiety medicine', 'depression ki goli',
      'psychiatric medicine side effects', 'sleeping pills awareness', 'ssri medication'
    ]
  },
  coping: {
    name: 'coping',
    title: 'Evidence-Based Coping Strategies',
    description: 'Practical grounding techniques (5-4-3-2-1), box breathing, progressive muscle relaxation (PMR), and journaling.',
    subtopics: ['54321_grounding', 'box_breathing', 'progressive_muscle_relaxation', 'thought_reframing', 'journaling'],
    synonyms: [
      'grounding exercise', '54321 technique', 'box breathing', 'breathing exercise',
      'zehni sukoon k tareeqay', 'relax kaise karein', 'coping skills',
      'tension kam karne ka tareeqa'
    ]
  },
  safety: {
    name: 'safety',
    title: 'Crisis Support & Immediate Safety Protocols',
    description: 'Crisis hotlines, emergency psychiatric protocols, and zero-tolerance safety guardrails.',
    subtopics: ['crisis_hotlines', 'safety_planning', 'emergency_assistance', 'crisis_contacts'],
    synonyms: [
      'suicide', 'khudkushi', 'ending my life', 'harm myself', 'khud ko nuqsan',
      'mar jane ko dil chahta hai', 'zindagi khatam', 'crisis helpline',
      'emergency mental help', '1122 mental crisis'
    ]
  }
};

module.exports = {
  DOMAIN: 'mental_health',
  TOPICS: MENTAL_HEALTH_TOPICS,
  TOPIC_KEYS: Object.keys(MENTAL_HEALTH_TOPICS),
};
