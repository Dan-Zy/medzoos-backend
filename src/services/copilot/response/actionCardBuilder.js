/**
 * Deterministic action card builder.
 * Max 4 cards. Deep-links use screen names + params (with mobile tab navigation).
 */

function createId(prefix = 'action') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function doctorNav(specialty) {
  return {
    tab: 'Home',
    screen: 'Services',
    params: {
      screen: 'DoctorsList',
      params: specialty
        ? { specialty, screenTitle: specialty, onlineOnly: false }
        : undefined,
    },
  };
}

function labNav(testSlug) {
  return {
    tab: 'Home',
    screen: 'Services',
    params: {
      screen: 'LabTestsList',
      params: testSlug ? { category: testSlug } : undefined,
    },
  };
}

function healthNav(protocol) {
  return {
    tab: 'Health',
    screen: 'HealthHome',
    params: protocol ? { protocol } : undefined,
  };
}

function pharmacyNav() {
  return {
    tab: 'Health',
    screen: 'MedicinesList',
  };
}

/**
 * @returns {import('../types/copilot.types').ActionCard[]}
 */
function buildEmergencyActions() {
  return [
    {
      id: createId(),
      type: 'call_emergency',
      label: 'Call 1122',
      reason: 'Immediate emergency services.',
      priority: 100,
      targetScreen: 'Emergency',
      params: { phone: '1122' },
      navigation: undefined,
    },
    {
      id: createId(),
      type: 'find_emergency_room',
      label: 'Find Nearest Emergency Department',
      reason: 'Emergency departments evaluate acute symptoms.',
      priority: 90,
      targetScreen: 'HospitalsList',
      params: { openNow: true },
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'HospitalsList' },
      },
    },
  ];
}

/**
 * @param {object} ctx
 * @param {object} ctx.decision - triage engine output
 * @param {object} ctx.extraction
 * @param {Array<{name:string,slug:string}>} [ctx.labs]
 * @param {object} [ctx.exerciseProtocol]
 * @param {object} [ctx.protocol]
 */
function buildActionCards(ctx) {
  const { decision, extraction, labs = [], exerciseProtocol, protocol } = ctx;
  /** @type {import('../types/copilot.types').ActionCard[]} */
  const actions = [];

  if (decision.reasonCode === 'CRISIS_SUICIDE_SELF_HARM_RED_FLAG') {
    return [
      {
        id: createId(),
        type: 'call_emergency',
        label: 'Call Umang 24/7 (0311-7786264)',
        reason: 'Free, confidential 24/7 mental health crisis support in Pakistan.',
        priority: 100,
        targetScreen: 'Emergency',
        params: { phone: '03117786264' },
        navigation: undefined,
      },
      {
        id: createId(),
        type: 'call_emergency',
        label: 'Call Emergency (1122)',
        reason: 'Immediate emergency response.',
        priority: 95,
        targetScreen: 'Emergency',
        params: { phone: '1122' },
        navigation: undefined,
      },
      {
        id: createId(),
        type: 'call_emergency',
        label: 'Call Rozan (0800-22444)',
        reason: 'Toll-free counseling helpline.',
        priority: 90,
        targetScreen: 'Emergency',
        params: { phone: '080022444' },
        navigation: undefined,
      },
    ];
  }

  if (decision.triageLevel === 'EMERGENCY' || decision.emergency) {
    return buildEmergencyActions();
  }

  if (decision.triageLevel === 'NEEDS_MORE_INFORMATION') {
    return [];
  }

  const specialty = decision.specialty || protocol?.specialty || 'General Physician';

  if (decision.triageLevel === 'URGENT' || decision.triageLevel === 'ROUTINE') {
    actions.push({
      id: createId(),
      type: 'book_doctor',
      label: `Consult ${specialty}`,
      reason: 'Deterministic specialty routing based on symptoms and protocol.',
      priority: 85,
      targetScreen: 'DoctorsList',
      params: { specialty },
      navigation: doctorNav(specialty),
    });
  }

  if (labs.length > 0 && decision.triageLevel !== 'SELF_CARE') {
    const lab = labs[0];
    actions.push({
      id: createId(),
      type: 'book_lab',
      label: `Discuss ${lab.name}`,
      reason: 'A clinician may recommend this test as part of evaluating your symptoms.',
      priority: 70,
      targetScreen: 'LabTestsList',
      params: { testSlug: lab.slug },
      navigation: labNav(lab.slug),
    });
  }

  if (
    decision.exerciseAllowed &&
    exerciseProtocol &&
    (extraction.requestedIntent === 'exercise' || decision.triageLevel === 'SELF_CARE')
  ) {
    actions.push({
      id: createId(),
      type: 'health_plan',
      label: 'View Safe Mobility Routine',
      reason: 'Exercise cleared by deterministic safety screen.',
      priority: 65,
      targetScreen: 'HealthHome',
      params: { protocol: exerciseProtocol.id },
      navigation: healthNav(exerciseProtocol.id),
    });
  } else if (protocol?.safeHomeCare?.length && decision.triageLevel === 'SELF_CARE') {
    actions.push({
      id: createId(),
      type: 'health_plan',
      label: 'View Care Tips',
      reason: 'Low-risk self-care protocol.',
      priority: 60,
      targetScreen: 'HealthHome',
      params: { protocol: protocol.id },
      navigation: healthNav(protocol.id),
    });
  }

  if (extraction.requestedIntent === 'pharmacy_search') {
    if (actions.length < 4 && decision.triageLevel !== 'URGENT') {
      actions.push({
        id: createId(),
        type: 'pharmacy',
        label: 'Browse Pharmacy Support',
        reason: 'Partner pharmacies — not a prescription.',
        priority: 45,
        targetScreen: 'MedicinesList',
        params: {},
        navigation: pharmacyNav(),
      });
    }
  }

  const isPhysicalSymptomReport =
    extraction.chiefComplaint &&
    extraction.requestedIntent !== 'general_health' &&
    extraction.requestedIntent !== 'lifestyle' &&
    extraction.requestedIntent !== 'medication' &&
    !/^(can i|what is|how to|why|is it safe|diet|fasting|sleep tips|guidelines)/i.test(extraction.chiefComplaint);

  if ((decision.triageLevel === 'SELF_CARE' || decision.triageLevel === 'ROUTINE') && isPhysicalSymptomReport) {
    actions.push({
      id: createId(),
      type: 'symptom_tracker',
      label: 'Track Symptoms',
      reason: 'Monitor changes and return if red flags appear.',
      priority: 40,
      targetScreen: 'HealthHome',
      params: { condition: extraction.chiefComplaint },
      navigation: healthNav(),
    });
  }

  if (decision.triageLevel === 'URGENT' && actions.length < 3) {
    actions.push({
      id: createId(),
      type: 'follow_up',
      label: 'Seek Care Today',
      reason: 'Urgent evaluation recommended.',
      priority: 80,
      targetScreen: 'DoctorsList',
      params: { specialty },
      navigation: doctorNav(specialty),
    });
  }

  // Deduplicate by label, sort by priority, max 4
  const byLabel = new Map();
  for (const a of actions) {
    const existing = byLabel.get(a.label);
    if (!existing || (a.priority || 0) > (existing.priority || 0)) {
      byLabel.set(a.label, a);
    }
  }

  return [...byLabel.values()]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 4);
}

/**
 * Patient-facing text (deterministic templates — LLM may only polish non-emergency later if desired).
 */
function buildPatientText(decision, protocol) {
  if (decision.triageLevel === 'EMERGENCY') {
    return 'This may require immediate medical attention. Please call emergency services (1122) or go to the nearest emergency department now.';
  }
  if (decision.triageLevel === 'NEEDS_MORE_INFORMATION') {
    return decision.text;
  }
  if (decision.triageLevel === 'URGENT') {
    return `${decision.reasoning} Please arrange prompt clinical care. If symptoms suddenly worsen, call 1122.`;
  }
  if (protocol?.patientSummary) return protocol.patientSummary;
  return decision.reasoning;
}

function buildSuggestedReplies(decision, specialty) {
  if (decision.triageLevel === 'EMERGENCY') return [];
  if (decision.triageLevel === 'NEEDS_MORE_INFORMATION') {
    return decision.suggestedReplies || [];
  }
  if (decision.triageLevel === 'SELF_CARE') {
    return ['Show me safe exercises', 'When should I see a doctor?', 'Track my symptoms'];
  }
  if (decision.triageLevel === 'URGENT') {
    return [
      specialty ? `Find ${specialty}` : 'Find a doctor',
      'What are warning signs?',
    ];
  }
  return [
    specialty ? `Consult ${specialty}` : 'Book a doctor',
    'Browse lab tests',
    'When should I seek urgent care?',
  ];
}

module.exports = {
  buildActionCards,
  buildEmergencyActions,
  buildPatientText,
  buildSuggestedReplies,
  doctorNav,
  labNav,
};
