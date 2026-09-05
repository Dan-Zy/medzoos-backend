/**
 * Deterministic risk-factor modifiers.
 * Prefer explicit clinical rules over arbitrary multipliers.
 */

/**
 * @param {import('../types/copilot.types').HealthContext|null|undefined} health
 * @returns {{
 *   hasDiabetes: boolean,
 *   hasHypertension: boolean,
 *   hasCardiovascularDisease: boolean,
 *   hasKidneyDisease: boolean,
 *   isPregnant: boolean,
 *   isOlderAdult: boolean,
 *   onAnticoagulant: boolean,
 *   immunocompromised: boolean,
 *   recentSurgery: boolean,
 *   factors: string[]
 * }}
 */
function evaluateRiskFactors(health) {
  const conditions = (health?.chronicConditions || []).map((c) => String(c).toLowerCase());
  const meds = (health?.activeMedications || []).map((m) => String(m).toLowerCase());
  const factors = [];

  const hasDiabetes = conditions.some((c) => /diabetes|diabetic/.test(c));
  const hasHypertension = conditions.some((c) => /hypertension|high blood pressure|htn/.test(c));
  const hasCardiovascularDisease = conditions.some((c) =>
    /heart|cardio|angina|cad|mi|stroke/.test(c),
  );
  const hasKidneyDisease = conditions.some((c) => /kidney|renal|ckd/.test(c));
  const isPregnant =
    health?.pregnancyStatus === 'pregnant' ||
    String(health?.pregnancyStatus || '').toLowerCase() === 'pregnant';
  const isOlderAdult = health?.age != null && health.age >= 65;
  const onAnticoagulant = meds.some((m) =>
    /warfarin|rivaroxaban|apixaban|heparin|anticoag/.test(m),
  );
  const immunocompromised = conditions.some((c) =>
    /immuno|cancer|chemotherapy|transplant|hiv/.test(c),
  );
  const recentSurgery = conditions.some((c) => /recent surgery|post.?op/.test(c));

  if (hasDiabetes) factors.push('diabetes');
  if (hasHypertension) factors.push('hypertension');
  if (hasCardiovascularDisease) factors.push('cardiovascular_disease');
  if (hasKidneyDisease) factors.push('kidney_disease');
  if (isPregnant) factors.push('pregnancy');
  if (isOlderAdult) factors.push('older_age');
  if (onAnticoagulant) factors.push('anticoagulant_use');
  if (immunocompromised) factors.push('immunocompromised');
  if (recentSurgery) factors.push('recent_surgery');

  return {
    hasDiabetes,
    hasHypertension,
    hasCardiovascularDisease,
    hasKidneyDisease,
    isPregnant,
    isOlderAdult,
    onAnticoagulant,
    immunocompromised,
    recentSurgery,
    factors,
  };
}

/**
 * Explicit escalation rules (not multiplicative scoring).
 * @returns {{ escalateTo: 'URGENT'|'EMERGENCY'|null, reasonCode: string|null }}
 */
function applyRiskEscalation(extraction, risk) {
  const complaint = extraction?.chiefComplaint;
  const associated = extraction?.associatedSymptoms || [];

  if (complaint === 'foot_wound' && risk.hasDiabetes) {
    return { escalateTo: 'URGENT', reasonCode: 'HIGH_RISK_DIABETIC_FOOT' };
  }

  if (
    complaint === 'fever' &&
    (risk.immunocompromised || risk.isOlderAdult) &&
    (extraction?.severityScale >= 6 || associated.includes('shortness_of_breath'))
  ) {
    return { escalateTo: 'URGENT', reasonCode: 'HIGH_RISK_FEVER' };
  }

  if (
    (complaint === 'chest_pain' || extraction?.bodySite === 'chest') &&
    (risk.hasCardiovascularDisease || risk.hasDiabetes) &&
    extraction?.severityScale != null &&
    extraction.severityScale >= 5
  ) {
    return { escalateTo: 'URGENT', reasonCode: 'HIGH_RISK_CHEST_SYMPTOM' };
  }

  if (risk.isPregnant && /abdomen|abdominal|bleeding|vaginal/.test(complaint || '')) {
    return { escalateTo: 'URGENT', reasonCode: 'PREGNANCY_CONCERN' };
  }

  if (risk.onAnticoagulant && /bleed|bruising|black tarry/.test(JSON.stringify(associated))) {
    return { escalateTo: 'URGENT', reasonCode: 'ANTICOAGULANT_BLEED_RISK' };
  }

  return { escalateTo: null, reasonCode: null };
}

module.exports = {
  evaluateRiskFactors,
  applyRiskEscalation,
};
