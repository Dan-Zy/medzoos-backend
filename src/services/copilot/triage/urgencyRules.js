/**
 * Deterministic urgency rules — application triage policy v2026-08-01.
 */

/**
 * @param {object} extraction
 * @param {ReturnType<typeof import('./riskFactors').evaluateRiskFactors>} risk
 * @returns {{ level: string, reasonCode: string, rulesTriggered: string[] }|null}
 */
function matchUrgentRules(extraction, risk) {
  const rulesTriggered = [];
  const severity = extraction?.severityScale;
  const associated = extraction?.associatedSymptoms || [];
  const complaint = extraction?.chiefComplaint;
  const onset = extraction?.onset;
  const duration = extraction?.durationHours;

  if (severity != null && severity >= 7) {
    rulesTriggered.push('SEVERE_PAIN');
    return { level: 'URGENT', reasonCode: 'SEVERE_PAIN', rulesTriggered };
  }

  if (onset === 'sudden' && (complaint === 'chest_pain' || complaint === 'headache')) {
    // Chest with sudden onset but not red-flag combo → still urgent clinical review
    if (complaint === 'chest_pain') {
      rulesTriggered.push('SUDDEN_CHEST_SYMPTOM');
      return { level: 'URGENT', reasonCode: 'SUDDEN_CHEST_SYMPTOM', rulesTriggered };
    }
  }

  if (
    complaint === 'fever' &&
    (associated.includes('shortness_of_breath') ||
      associated.includes('rash') ||
      (duration != null && duration >= 72 && severity != null && severity >= 5))
  ) {
    rulesTriggered.push('CONCERNING_FEVER');
    return { level: 'URGENT', reasonCode: 'CONCERNING_FEVER', rulesTriggered };
  }

  if (complaint === 'vomiting' && (duration != null && duration >= 24 || severity >= 6)) {
    rulesTriggered.push('PERSISTENT_VOMITING');
    return { level: 'URGENT', reasonCode: 'PERSISTENT_VOMITING', rulesTriggered };
  }

  if (complaint === 'foot_wound' && risk.hasDiabetes) {
    rulesTriggered.push('HIGH_RISK_DIABETIC_FOOT');
    return { level: 'URGENT', reasonCode: 'HIGH_RISK_DIABETIC_FOOT', rulesTriggered };
  }

  if (
    associated.includes('weakness') &&
    (complaint === 'headache' || extraction?.bodySite === 'head') &&
    onset === 'sudden'
  ) {
    rulesTriggered.push('NEW_NEURO_SYMPTOM');
    return { level: 'URGENT', reasonCode: 'NEW_NEURO_SYMPTOM', rulesTriggered };
  }

  if (/worsen|getting worse|rapidly/.test(JSON.stringify(extraction))) {
    // checked via associated / complaint text in pipeline instead
  }

  return null;
}

/**
 * Fields required before a safe routine/self-care decision for symptom triage.
 * @param {object} extraction
 * @returns {string[]} missing field keys
 */
function getMissingRequiredFields(extraction) {
  const missing = [];
  const intent = extraction?.requestedIntent;
  const complaint = extraction?.chiefComplaint;

  // Provider search / wellness can proceed with less clinical detail
  if (intent === 'doctor_search' || intent === 'lab_test' || intent === 'pharmacy_search') {
    return missing;
  }
  if (intent === 'general_health' && (!complaint || complaint === 'general_symptom')) {
    return missing;
  }

  const needsClinicalDetail =
    intent === 'triage' ||
    intent === 'exercise' ||
    intent === 'unknown' ||
    ['chest_pain', 'lower_back_pain', 'fever', 'foot_wound', 'vomiting', 'headache'].includes(
      complaint,
    ) ||
    /back|chest|fever|headache|wound|kamar|seena|seene|bukhar|dard|pain/i.test(String(complaint || '')) ||
    ['back', 'chest', 'head', 'foot', 'kamar', 'seena'].includes(extraction?.bodySite || '');

  if (!needsClinicalDetail) return missing;

  if (!complaint || complaint === 'general_symptom') {
    missing.push('chiefComplaint');
  }

  const clinicallySensitive =
    ['chest_pain', 'lower_back_pain', 'fever', 'headache', 'foot_wound'].includes(complaint) ||
    /back|chest|fever|headache|wound|kamar|seena|seene|bukhar|dard|pain/i.test(String(complaint || '')) ||
    ['back', 'chest', 'head', 'foot', 'kamar', 'seena'].includes(extraction?.bodySite || '');

  // "My back hurts" / "Kamar mein dard" without severity/duration → clarify (never invent)
  if (clinicallySensitive && extraction?.severityScale == null) {
    missing.push('severityScale');
  }

  if (
    clinicallySensitive &&
    extraction?.durationHours == null &&
    extraction?.onset === 'unknown'
  ) {
    missing.push('durationOrOnset');
  }

  return missing;
}

/**
 * Build clarification payload (max 2 questions via suggested replies).
 */
function buildClarification(missing) {
  const suggestedReplies = [];
  let text = 'More information is needed to safely assess urgency.';

  if (missing.includes('severityScale') && missing.includes('durationOrOnset')) {
    text = 'How severe is your pain (1–10) and when did it start?';
    suggestedReplies.push('1–3 / 10', '4–6 / 10', '7–10 / 10');
  } else if (missing.includes('severityScale')) {
    text = 'On a scale of 1–10, how severe are your symptoms right now?';
    suggestedReplies.push('1–3 / 10', '4–6 / 10', '7–10 / 10');
  } else if (missing.includes('durationOrOnset')) {
    text = 'When did this start?';
    suggestedReplies.push('Just now', 'Today', 'A few days ago');
  } else if (missing.includes('chiefComplaint')) {
    text = 'What is bothering you the most right now?';
    suggestedReplies.push('Pain', 'Fever', 'Breathing problem', 'Something else');
  }

  return {
    triageLevel: 'NEEDS_MORE_INFORMATION',
    emergency: false,
    reasonCode: 'MISSING_CLINICAL_DETAIL',
    reasoning: 'More information is needed to safely assess urgency.',
    text,
    actions: [],
    suggestedReplies: suggestedReplies.slice(0, 4),
  };
}

module.exports = {
  matchUrgentRules,
  getMissingRequiredFields,
  buildClarification,
};
