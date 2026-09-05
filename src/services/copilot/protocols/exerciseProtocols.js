/**
 * Exercise safety engine + phased protocols.
 * Exercise is blocked when red flags or urgent/emergency triage apply.
 */

const { normalizeText } = require('../triage/textNormalizer');

const BACK_EXERCISE_RED_FLAGS = [
  'bowel incontinence',
  'bladder incontinence',
  'urinary retention',
  'saddle anesthesia',
  'saddle numbness',
  'progressive weakness',
  'progressive leg weakness',
  'major trauma',
  'fever with severe back pain',
  'known cancer',
];

/**
 * @param {string} message
 * @param {object} extraction
 * @returns {{ allowed: boolean, reasonCode: string|null, reason: string|null }}
 */
function screenExerciseSafety(message, extraction) {
  const text = normalizeText(
    `${message} ${(extraction?.associatedSymptoms || []).join(' ')} ${extraction?.chiefComplaint || ''}`,
  );

  for (const flag of BACK_EXERCISE_RED_FLAGS) {
    if (text.includes(flag.replace(/_/g, ' '))) {
      return {
        allowed: false,
        reasonCode: 'EXERCISE_CONTRAINDICATED_RED_FLAG',
        reason: 'Exercise is not appropriate when neurological or systemic red flags are present.',
      };
    }
  }

  const site = extraction?.bodySite;
  const complaint = extraction?.chiefComplaint;
  const isBackRelated =
    site === 'back' || complaint === 'lower_back_pain' || /back/.test(text);

  if (isBackRelated) {
    if (
      text.includes('incontinence') ||
      text.includes('retention') ||
      text.includes('saddle') ||
      (text.includes('leg') && text.includes('weak'))
    ) {
      return {
        allowed: false,
        reasonCode: 'CAUDA_EQUINA_RED_FLAG',
        reason: 'Back pain with neurological red flags — do not provide exercises.',
      };
    }
  }

  if (extraction?.severityScale != null && extraction.severityScale >= 7) {
    return {
      allowed: false,
      reasonCode: 'SEVERE_PAIN',
      reason: 'Severe pain — exercise protocols are deferred until clinical review.',
    };
  }

  return { allowed: true, reasonCode: null, reason: null };
}

const EXERCISE_PROTOCOLS = {
  lower_back_strain_exercises: {
    id: 'lower_back_strain_exercises',
    phases: {
      acute: [
        'Gentle range of motion',
        'Isometric core activation if pain-free',
        'Short walking intervals',
      ],
      subacute: [
        'Core stabilization',
        'Gentle mobility',
        'Low-impact strengthening',
      ],
      maintenance: [
        'Progressive strengthening',
        'Functional movement',
        'Postural conditioning',
      ],
    },
    contraindications: [
      'bowel/bladder dysfunction',
      'saddle anesthesia',
      'progressive weakness',
      'fever with severe back pain',
      'major trauma',
    ],
    minimumRequirements: [
      'No emergency red flags',
      'Pain typically mild–moderate',
      'Able to walk short distances',
    ],
    stopConditions: [
      'New weakness or numbness',
      'Worsening severe pain',
      'Bladder or bowel changes',
    ],
    medicalDisclaimer:
      'These are general mobility suggestions, not a prescription. Stop if symptoms worsen and seek clinical care.',
  },
  general_mobility: {
    id: 'general_mobility',
    phases: {
      acute: ['Short walks', 'Gentle stretching within comfort'],
      subacute: ['Light strengthening', 'Mobility flow'],
      maintenance: ['Progressive activity', 'Postural habits'],
    },
    contraindications: ['chest pain', 'severe dyspnea', 'acute injury'],
    minimumRequirements: ['No emergency or urgent red flags'],
    stopConditions: ['Chest pain', 'Dizziness', 'Severe pain'],
    medicalDisclaimer:
      'General wellness mobility only — not a treatment plan for injury or disease.',
  },
};

/**
 * @param {object} extraction
 * @returns {object|null}
 */
function selectExerciseProtocol(extraction) {
  if (
    extraction?.bodySite === 'back' ||
    extraction?.chiefComplaint === 'lower_back_pain' ||
    extraction?.requestedIntent === 'exercise'
  ) {
    if (
      extraction?.bodySite === 'back' ||
      extraction?.chiefComplaint === 'lower_back_pain'
    ) {
      return EXERCISE_PROTOCOLS.lower_back_strain_exercises;
    }
    return EXERCISE_PROTOCOLS.general_mobility;
  }
  return null;
}

module.exports = {
  screenExerciseSafety,
  selectExerciseProtocol,
  EXERCISE_PROTOCOLS,
  BACK_EXERCISE_RED_FLAGS,
};
