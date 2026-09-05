const express = require('express');
const router = express.Router();
const doctorsController = require('./doctors.controller');
const doctorsValidator = require('./doctors.validator');
const { validate } = require('../../middleware/validate.middleware');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

router.get('/filters', doctorsController.getFilters);
router.get('/appointments/me', protect, restrictTo('customer'), doctorsController.getMyAppointments);
router.get('/appointments/:id', protect, restrictTo('customer'), doctorsController.getMyAppointment);
router.post(
  '/appointments',
  protect,
  restrictTo('customer'),
  validate(doctorsValidator.bookAppointmentSchema),
  doctorsController.bookAppointment
);
router.delete(
  '/appointments/:id',
  protect,
  restrictTo('customer'),
  doctorsController.cancelAppointment
);
router.patch(
  '/appointments/:id',
  protect,
  restrictTo('customer'),
  validate(doctorsValidator.rescheduleAppointmentSchema),
  doctorsController.updateAppointment
);
router.post(
  '/appointments/:id/join',
  protect,
  restrictTo('customer'),
  doctorsController.joinConsultation
);
router.patch(
  '/appointments/:id/mode',
  protect,
  restrictTo('customer'),
  validate(doctorsValidator.selectConsultationModeSchema),
  doctorsController.selectConsultationMode
);
router.get(
  '/consultation/:meetingId',
  protect,
  doctorsController.getConsultation
);
router.post(
  '/:id/reviews',
  protect,
  restrictTo('customer'),
  validate(doctorsValidator.submitDoctorReviewSchema),
  doctorsController.submitDoctorReview
);
router.patch(
  '/:id/slots',
  protect,
  restrictTo('doctor'),
  validate(doctorsValidator.updateSlotsSchema),
  doctorsController.updateDoctorSlots
);
router.get('/', doctorsController.getDoctors);
router.get('/:id/reviews', doctorsController.getDoctorReviews);
router.get('/:id/practice-locations', doctorsController.getDoctorPracticeLocations);
router.get('/:id/slots', doctorsController.getDoctorSlots);
router.get('/:id', doctorsController.getDoctor);

router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  async (req, res, next) => {
    try {
      const adminDoctorService = require('../admin/adminDoctor.service');
      const doctor = await adminDoctorService.updateDoctor(req.params.id, req.body, req.user?.id);
      res.json({
        status: 'success',
        message: 'Doctor updated successfully',
        data: { doctor },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  protect,
  restrictTo('admin'),
  async (req, res, next) => {
    try {
      const adminDoctorService = require('../admin/adminDoctor.service');
      const doctor = await adminDoctorService.updateDoctor(req.params.id, req.body, req.user?.id);
      res.json({
        status: 'success',
        message: 'Doctor updated successfully',
        data: { doctor },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

