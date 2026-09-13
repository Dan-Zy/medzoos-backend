const express = require('express');
const router = express.Router();
const followUpsController = require('./followUps.controller');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

router.use(protect, restrictTo('customer'));

router.get('/', followUpsController.listPatientFollowUps);
router.get('/:id', followUpsController.getPatientFollowUp);
router.get('/:id/available-slots', followUpsController.getAvailableSlots);
router.post('/:id/book', followUpsController.bookFollowUp);
router.post('/:id/decline', followUpsController.declineFollowUp);

module.exports = router;
