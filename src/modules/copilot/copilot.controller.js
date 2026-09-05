const catchAsync = require('../../utils/catchAsync');
const { sendResponse } = require('../../utils/response');
const copilotService = require('./copilot.service');

const createSession = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.user?.accountId || null;
  const result = await copilotService.startSession(userId);
  sendResponse(res, 201, result, 'Copilot session started');
});

const sendMessage = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.user?.accountId || null;
  const result = await copilotService.postMessage(
    userId,
    req.params.sessionId,
    req.body.message,
  );
  sendResponse(res, 200, result, 'Message processed');
});

const getSession = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.user?.accountId || null;
  const result = await copilotService.getSession(userId, req.params.sessionId);
  if (!result) {
    return sendResponse(res, 404, null, 'Session not found');
  }
  sendResponse(res, 200, result, 'Session fetched');
});

const triage = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.user?.accountId || null;
  const result = await copilotService.triage(
    userId,
    req.body.message,
    req.body.answers || {},
  );
  sendResponse(res, 200, result, 'Triage completed');
});

module.exports = { createSession, sendMessage, getSession, triage };
