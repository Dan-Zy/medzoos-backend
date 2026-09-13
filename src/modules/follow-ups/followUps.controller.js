const catchAsync = require('../../utils/catchAsync');
const { sendResponse } = require('../../utils/response');
const followUpsService = require('./followUps.service');

const upsertConsultationFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.upsertFollowUpForConsultation(
    req.params.id,
    req.body,
    { notify: true },
  );
  sendResponse(res, 200, { followUp }, 'Follow-up saved');
});

const listDoctorFollowUps = catchAsync(async (req, res) => {
  const followUps = await followUpsService.listDoctorFollowUps(req.user.id, {
    status: req.query.status,
  });
  sendResponse(res, 200, { followUps }, 'Follow-ups fetched');
});

const getDoctorFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.getFollowUpForDoctor(req.user.id, req.params.id);
  sendResponse(res, 200, { followUp }, 'Follow-up fetched');
});

const remindFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.remindFollowUp(req.user.id, req.params.id);
  sendResponse(res, 200, { followUp }, 'Reminder sent');
});

const cancelFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.cancelFollowUp(req.user.id, req.params.id);
  sendResponse(res, 200, { followUp }, 'Follow-up cancelled');
});

const listPatientFollowUps = catchAsync(async (req, res) => {
  const followUps = await followUpsService.listPatientFollowUps(req.user.id, {
    status: req.query.status,
  });
  sendResponse(res, 200, { followUps }, 'Follow-ups fetched');
});

const getPatientFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.getFollowUpForPatient(req.user.id, req.params.id);
  sendResponse(res, 200, { followUp }, 'Follow-up fetched');
});

const getAvailableSlots = catchAsync(async (req, res) => {
  const slots = await followUpsService.getAvailableSlots(req.user.id, req.params.id);
  sendResponse(res, 200, slots, 'Available follow-up slots');
});

const bookFollowUp = catchAsync(async (req, res) => {
  const result = await followUpsService.bookFollowUp(req.user.id, req.params.id, req.body);
  sendResponse(res, 201, result, 'Follow-up booked');
});

const declineFollowUp = catchAsync(async (req, res) => {
  const followUp = await followUpsService.declineFollowUp(
    req.user.id,
    req.params.id,
    req.body?.reason,
  );
  sendResponse(res, 200, { followUp }, 'Follow-up declined');
});

module.exports = {
  upsertConsultationFollowUp,
  listDoctorFollowUps,
  getDoctorFollowUp,
  remindFollowUp,
  cancelFollowUp,
  listPatientFollowUps,
  getPatientFollowUp,
  getAvailableSlots,
  bookFollowUp,
  declineFollowUp,
};
