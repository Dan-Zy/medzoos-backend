/**
 * Deterministic lab mapping — evaluation options, not diagnoses.
 */

const LAB_MAPPING = {
  fever_acute: [{ name: 'Complete Blood Count', slug: 'cbc' }],
  chest_pain_non_emergency: [{ name: 'ECG', slug: 'ecg' }],
  foot_wound_diabetes: [{ name: 'Complete Blood Count', slug: 'cbc' }],
  diabetes_followup: [{ name: 'HbA1c', slug: 'hba1c' }],
  lipid_screening: [{ name: 'Lipid Profile', slug: 'lipid_profile' }],
};

/**
 * @param {string|null} protocolId
 * @param {string|null} testHint
 * @returns {Array<{name:string,slug:string}>}
 */
function resolveLabs(protocolId, testHint) {
  const labs = [];
  if (protocolId && LAB_MAPPING[protocolId]) {
    labs.push(...LAB_MAPPING[protocolId]);
  }
  if (testHint) {
    const slug = String(testHint).toLowerCase().replace(/\s+/g, '_');
    const nameMap = {
      cbc: 'Complete Blood Count',
      hba1c: 'HbA1c',
      ecg: 'ECG',
      lipid_profile: 'Lipid Profile',
    };
    if (!labs.some((l) => l.slug === slug)) {
      labs.push({ name: nameMap[slug] || testHint, slug });
    }
  }
  return labs.slice(0, 3);
}

module.exports = {
  LAB_MAPPING,
  resolveLabs,
};
