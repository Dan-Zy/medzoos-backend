/**
 * Deterministic specialty mapping.
 * Values MUST match doctors.service FILTER_OPTIONS specialties where possible.
 */

const SPECIALTY_MAPPING = {
  lower_back_pain: ['Orthopedic', 'General Physician'],
  chest_pain: ['Cardiologist', 'General Physician'],
  persistent_fever: ['General Physician'],
  fever: ['General Physician'],
  skin_rash: ['Dermatologist'],
  headache: ['General Physician'],
  cough_cold: ['General Physician'],
  foot_wound: ['General Physician', 'Orthopedic'],
  mental_health: ['Psychiatrist'],
  pregnancy: ['Gynecologist'],
  pediatric: ['Pediatrician'],
  wellness: ['General Physician'],
};

/**
 * Normalize LLM/heuristic specialty hints to DB specialty strings.
 * @param {string|null|undefined} hint
 * @returns {string|null}
 */
function normalizeSpecialty(hint) {
  if (!hint) return null;
  const h = String(hint).toLowerCase();
  if (h.includes('cardio')) return 'Cardiologist';
  if (h.includes('derma')) return 'Dermatologist';
  if (h.includes('pedia') || h.includes('child')) return 'Pediatrician';
  if (h.includes('gyn') || h.includes('obstet')) return 'Gynecologist';
  if (h.includes('psych')) return 'Psychiatrist';
  if (h.includes('ortho') || h.includes('physio') || h.includes('bone')) return 'Orthopedic';
  if (h.includes('general') || h.includes('gp') || h.includes('physician')) {
    return 'General Physician';
  }
  const allowed = [
    'General Physician',
    'Cardiologist',
    'Dermatologist',
    'Pediatrician',
    'Gynecologist',
    'Psychiatrist',
    'Orthopedic',
  ];
  const exact = allowed.find((s) => s.toLowerCase() === h);
  return exact || null;
}

/**
 * @param {string|null} complaint
 * @param {string|null} specialtyHint
 * @returns {string|null}
 */
function resolveSpecialty(complaint, specialtyHint) {
  const fromHint = normalizeSpecialty(specialtyHint);
  if (fromHint) return fromHint;
  const mapped = SPECIALTY_MAPPING[complaint || ''];
  return mapped?.[0] || null;
}

module.exports = {
  SPECIALTY_MAPPING,
  normalizeSpecialty,
  resolveSpecialty,
};
