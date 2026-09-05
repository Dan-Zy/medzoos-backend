/**
 * Lightweight triage audit log.
 * Avoid storing unnecessary sensitive free-text when possible.
 */

const { logger } = require('../../../utils/logger');

/** @type {Array<object>} */
const memoryAudit = [];
const MAX_MEMORY = 500;

/**
 * @param {object} record
 */
function recordTriageAudit(record) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId: record.userId || null,
    triageLevel: record.triageLevel,
    reasonCode: record.reasonCode,
    protocolVersion: record.protocolVersion || '2026-08-01',
    redFlagsTriggered: record.redFlagsTriggered || [],
    rulesTriggered: record.rulesTriggered || [],
    extractionSource: record.extractionSource || null,
    chiefComplaint: record.chiefComplaint || null,
    requestedIntent: record.requestedIntent || null,
    protocolId: record.protocolId || null,
  };

  memoryAudit.push(entry);
  if (memoryAudit.length > MAX_MEMORY) memoryAudit.shift();

  logger.info('copilot_triage_audit', entry);
  return entry;
}

function getRecentAudits(limit = 50) {
  return memoryAudit.slice(-limit);
}

module.exports = {
  recordTriageAudit,
  auditTriageDecision: recordTriageAudit,
  getRecentAudits,
};
