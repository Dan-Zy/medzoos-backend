const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const recordSharesController = require('./recordShares.controller');

router.use(protect, restrictTo('customer'));

router.get('/shareable', recordSharesController.listShareableHistory);
router.get('/shares', recordSharesController.listMyShareEvents);
router.post('/appointments/:appointmentId/share', recordSharesController.saveAppointmentShares);
router.post(
  '/appointments/:appointmentId/revoke',
  recordSharesController.revokeAppointmentShares,
);
router.post('/grants/:grantId/revoke', recordSharesController.revokeGrant);

module.exports = router;
