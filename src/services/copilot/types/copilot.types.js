/**
 * Medzoos Clinical Triage — shared types (JSDoc).
 * Application triage policy version — not a certified ESI/MTS claim.
 */

const PROTOCOL_VERSION = '2026-08-01';

/** @typedef {'EMERGENCY'|'URGENT'|'ROUTINE'|'SELF_CARE'|'NEEDS_MORE_INFORMATION'} TriageLevel */

/** @typedef {'call_emergency'|'find_emergency_room'|'book_doctor'|'book_lab'|'health_plan'|'symptom_tracker'|'pharmacy'|'follow_up'|'order_medicine'|'emergency_alert'} ActionType */

/**
 * @typedef {Object} ActionCard
 * @property {string} id
 * @property {ActionType|string} type
 * @property {string} label
 * @property {string} [reason]
 * @property {number} [priority]
 * @property {string} [targetScreen]
 * @property {Record<string, unknown>} [params]
 * @property {{ tab?: string, screen?: string, params?: Record<string, unknown> }} [navigation]
 */

/**
 * @typedef {Object} SymptomEntityExtraction
 * @property {string|null} chiefComplaint
 * @property {number|null} durationHours
 * @property {number|null} severityScale
 * @property {string[]} associatedSymptoms
 * @property {string|null} bodySite
 * @property {'sudden'|'gradual'|'unknown'} onset
 * @property {'triage'|'exercise'|'lab_test'|'doctor_search'|'pharmacy_search'|'general_health'|'unknown'} requestedIntent
 * @property {string[]} redFlagsDetected
 * @property {'pregnant'|'not_pregnant'|'unknown'|null} pregnancyStatus
 * @property {'child'|'adult'|'older_adult'|'unknown'} ageGroup
 * @property {number} confidence
 * @property {string|null} [specialtyHint]
 * @property {string|null} [testHint]
 */

/**
 * @typedef {Object} HealthContext
 * @property {number|null} age
 * @property {string|null} gender
 * @property {string[]} chronicConditions
 * @property {string[]} activeMedications
 * @property {string[]} allergies
 * @property {Array<{name:string,value?:string,unit?:string,date?:string}>} recentLabs
 * @property {string[]} recentDiagnoses
 * @property {unknown[]} recentAppointments
 * @property {string} [pregnancyStatus]
 * @property {{ name?: string, firstName?: string }} [personal]
 */

/**
 * @typedef {Object} TriageResponse
 * @property {TriageLevel} triageLevel
 * @property {boolean} emergency
 * @property {string} reasonCode
 * @property {string} reasoning
 * @property {string} text
 * @property {ActionCard[]} actions
 * @property {string[]} suggestedReplies
 * @property {Object} [metadata]
 * @property {string} [metadata.protocol]
 * @property {string} [metadata.specialty]
 * @property {number} [metadata.confidence]
 * @property {string} [metadata.protocolVersion]
 * @property {string[]} [metadata.rulesTriggered]
 * @property {string[]} [metadata.redFlagsTriggered]
 */

/**
 * Map legacy risk levels used by mobile UI.
 * @param {TriageLevel} level
 * @returns {'critical'|'high'|'medium'|'low'|null}
 */
function triageLevelToRisk(level) {
  switch (level) {
    case 'EMERGENCY':
      return 'critical';
    case 'URGENT':
      return 'high';
    case 'ROUTINE':
      return 'medium';
    case 'SELF_CARE':
      return 'low';
    default:
      return null;
  }
}

module.exports = {
  PROTOCOL_VERSION,
  triageLevelToRisk,
};
