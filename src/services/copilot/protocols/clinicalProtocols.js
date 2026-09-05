/**
 * Deterministic clinical protocol registry.
 * Application triage policy v2026-08-01 — NOT a certified ESI/MTS implementation.
 * Review status: draft clinical ops. Source: Medzoos application safety policy.
 */

const { PROTOCOL_VERSION } = require('../types/copilot.types');

/**
 * @typedef {Object} ClinicalProtocol
 * @property {string} id
 * @property {string} specialty
 * @property {Array<{name:string,slug:string}>} recommendedLabs
 * @property {string[]} contraindicatedExercises
 * @property {string[]} safeHomeCare
 * @property {string[]} redFlags
 * @property {string[]} stopConditions
 * @property {number} [followUpHours]
 * @property {string} [patientSummary]
 */

/** @type {Record<string, ClinicalProtocol>} */
const CLINICAL_PROTOCOLS = {
  lower_back_pain_mechanical: {
    id: 'lower_back_pain_mechanical',
    specialty: 'Orthopedic',
    recommendedLabs: [],
    contraindicatedExercises: ['Heavy deadlifts', 'Extreme spinal twisting'],
    safeHomeCare: [
      'Gentle mobility',
      'Short walking intervals',
      'Heat or cold according to comfort',
    ],
    redFlags: [
      'bowel_bladder_dysfunction',
      'saddle_anesthesia',
      'progressive_weakness',
    ],
    stopConditions: ['new weakness', 'new numbness', 'worsening severe pain'],
    followUpHours: 48,
    patientSummary:
      'Your symptoms may be consistent with mechanical back discomfort. If symptoms worsen, new weakness or numbness develops, or bladder or bowel problems occur, seek urgent medical care.',
  },
  fever_acute: {
    id: 'fever_acute',
    specialty: 'General Physician',
    recommendedLabs: [{ name: 'Complete Blood Count', slug: 'cbc' }],
    contraindicatedExercises: ['Intense workouts while febrile'],
    safeHomeCare: ['Rest', 'Hydration', 'Monitor temperature every 4–6 hours'],
    redFlags: ['severe_dyspnea', 'altered_consciousness', 'petechial_rash'],
    stopConditions: ['fever above 39 with confusion', 'difficulty breathing'],
    followUpHours: 24,
    patientSummary:
      'A clinician may recommend evaluation for fever. Rest and fluids may help while you arrange care if symptoms persist.',
  },
  chest_pain_non_emergency: {
    id: 'chest_pain_non_emergency',
    specialty: 'Cardiologist',
    recommendedLabs: [{ name: 'ECG', slug: 'ecg' }],
    contraindicatedExercises: ['Strenuous exercise until cleared'],
    safeHomeCare: ['Rest', 'Avoid exertion', 'Seek care if symptoms worsen'],
    redFlags: ['crushing_pain', 'radiation', 'sweating', 'dyspnea'],
    stopConditions: ['worsening chest pain', 'shortness of breath', 'fainting'],
    followUpHours: 12,
    patientSummary:
      'Chest symptoms should be reviewed by a clinician. Avoid exertion and seek emergency care if pain worsens, spreads to the arm or jaw, or comes with sweating or breathlessness.',
  },
  cough_cold_mild: {
    id: 'cough_cold_mild',
    specialty: 'General Physician',
    recommendedLabs: [],
    contraindicatedExercises: [],
    safeHomeCare: ['Warm fluids', 'Rest', 'Steam inhalation if comfortable'],
    redFlags: ['severe_dyspnea', 'blue_lips', 'high_fever_prolonged'],
    stopConditions: ['worsening breathlessness', 'chest pain', 'confusion'],
    followUpHours: 72,
    patientSummary:
      'Mild cough or cold symptoms often improve with rest and fluids. See a clinician if breathing worsens or fever persists.',
  },
  headache_mild: {
    id: 'headache_mild',
    specialty: 'General Physician',
    recommendedLabs: [],
    contraindicatedExercises: [],
    safeHomeCare: ['Rest in a quiet room', 'Hydration', 'Limit screens'],
    redFlags: ['sudden_worst_headache', 'neurological_deficit', 'neck_stiffness_fever'],
    stopConditions: ['sudden severe headache', 'vision loss', 'weakness'],
    followUpHours: 48,
    patientSummary:
      'Mild headaches often settle with rest and hydration. Seek urgent care for the worst headache of your life, weakness, or fever with stiff neck.',
  },
  skin_rash: {
    id: 'skin_rash',
    specialty: 'Dermatologist',
    recommendedLabs: [],
    contraindicatedExercises: [],
    safeHomeCare: ['Avoid scratching', 'Keep area clean', 'Note new triggers'],
    redFlags: ['throat_swelling', 'difficulty_breathing', 'widespread_blistering'],
    stopConditions: ['spreading rapidly', 'breathing difficulty'],
    followUpHours: 72,
    patientSummary:
      'A dermatologist or GP can review skin rashes. Seek emergency care for swelling of the throat or tongue or breathing difficulty.',
  },
  foot_wound_diabetes: {
    id: 'foot_wound_diabetes',
    specialty: 'General Physician',
    recommendedLabs: [{ name: 'Complete Blood Count', slug: 'cbc' }],
    contraindicatedExercises: ['Weight-bearing on infected foot'],
    safeHomeCare: ['Keep wound clean and covered', 'Offload pressure', 'Do not delay clinician review'],
    redFlags: ['spreading_redness', 'fever', 'pus', 'black_tissue'],
    stopConditions: ['spreading infection', 'fever', 'increasing pain'],
    followUpHours: 12,
    patientSummary:
      'Foot wounds with diabetes need prompt clinical review. Do not rely on self-care alone.',
  },
  wellness_general: {
    id: 'wellness_general',
    specialty: 'General Physician',
    recommendedLabs: [],
    contraindicatedExercises: [],
    safeHomeCare: ['Hydration', 'Light mobility', 'Regular sleep'],
    redFlags: [],
    stopConditions: ['new acute symptoms'],
    followUpHours: 168,
    patientSummary:
      'General wellness tips are not a medical assessment. Contact a clinician if new symptoms appear.',
  },
};

/**
 * @param {object} extraction
 * @returns {string|null}
 */
function selectProtocolId(extraction) {
  const complaint = String(extraction?.chiefComplaint || '').toLowerCase();
  const site = extraction?.bodySite || '';
  const intent = extraction?.requestedIntent;

  if (complaint.includes('foot') && complaint.includes('wound')) return 'foot_wound_diabetes';
  if (complaint === 'foot_wound') return 'foot_wound_diabetes';
  if (complaint.includes('chest') || site === 'chest') return 'chest_pain_non_emergency';
  if (complaint.includes('back') || site === 'back') return 'lower_back_pain_mechanical';
  if (complaint.includes('fever')) return 'fever_acute';
  if (complaint.includes('cough') || complaint.includes('cold')) return 'cough_cold_mild';
  if (complaint.includes('headache')) return 'headache_mild';
  if (complaint.includes('rash') || complaint.includes('skin')) return 'skin_rash';
  if (intent === 'exercise' && (site === 'back' || complaint.includes('back'))) {
    return 'lower_back_pain_mechanical';
  }
  if (intent === 'general_health' || intent === 'exercise') return 'wellness_general';
  return null;
}

/**
 * @param {string|null} protocolId
 * @returns {ClinicalProtocol|null}
 */
function getProtocol(protocolId) {
  if (!protocolId) return null;
  return CLINICAL_PROTOCOLS[protocolId] || null;
}

module.exports = {
  PROTOCOL_VERSION,
  CLINICAL_PROTOCOLS,
  selectProtocolId,
  getProtocol,
};
