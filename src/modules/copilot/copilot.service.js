const copilotOrchestrator = require('../../services/copilot/CopilotOrchestrator');

async function startSession(userId) {
  return copilotOrchestrator.createSession(userId);
}

async function postMessage(userId, sessionId, text) {
  return copilotOrchestrator.sendMessage(userId, sessionId, text);
}

async function getSession(userId, sessionId) {
  return copilotOrchestrator.getSession(userId, sessionId);
}

async function triage(userId, message, answers = {}) {
  return copilotOrchestrator.triageOnce(userId, message, answers);
}

module.exports = { startSession, postMessage, getSession, triage };
