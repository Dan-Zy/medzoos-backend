const express = require('express');
const router = express.Router();
const copilotController = require('./copilot.controller');
const copilotValidator = require('./copilot.validator');
const { validate } = require('../../middleware/validate.middleware');
const { optionalAuth } = require('../../middleware/auth.middleware');

router.use(optionalAuth);

router.post('/sessions', copilotController.createSession);
router.get('/sessions/:sessionId', copilotController.getSession);
router.post(
  '/sessions/:sessionId/messages',
  validate(copilotValidator.sendMessageSchema),
  copilotController.sendMessage,
);
router.post(
  '/triage',
  validate(copilotValidator.triageSchema),
  copilotController.triage,
);

module.exports = router;
