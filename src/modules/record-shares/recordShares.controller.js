const catchAsync = require('../../utils/catchAsync');
const { sendResponse } = require('../../utils/response');
const recordSharesService = require('./recordShares.service');

const listShareableHistory = catchAsync(async (req, res) => {
  const data = await recordSharesService.listShareableHistory(req.user.id);
  sendResponse(res, 200, data, 'Shareable medical history fetched');
});

const saveAppointmentShares = catchAsync(async (req, res) => {
  const result = await recordSharesService.saveAppointmentGrants(
    req.user.id,
    req.params.appointmentId,
    req.body?.grants || req.body?.share_grants || [],
  );
  sendResponse(res, 200, result, 'Shared records saved for this appointment');
});

const listMyShareEvents = catchAsync(async (req, res) => {
  const data = await recordSharesService.listPatientShareEvents(req.user.id);
  sendResponse(res, 200, data, 'Shared medical history events fetched');
});

const revokeAppointmentShares = catchAsync(async (req, res) => {
  const result = await recordSharesService.revokeAppointmentShares(
    req.user.id,
    req.params.appointmentId,
  );
  sendResponse(res, 200, result, 'Shared access revoked for this appointment');
});

const revokeGrant = catchAsync(async (req, res) => {
  const result = await recordSharesService.revokeGrantById(req.user.id, req.params.grantId);
  sendResponse(res, 200, result, 'Share grant revoked');
});

const getDoctorAppointmentSharedHistory = catchAsync(async (req, res) => {
  const data = await recordSharesService.getAppointmentSharedHistory(
    req.user.id,
    req.params.appointmentId || req.params.id,
  );
  sendResponse(res, 200, { sharedHistory: data }, 'Shared medical history fetched');
});

module.exports = {
  listShareableHistory,
  saveAppointmentShares,
  listMyShareEvents,
  revokeAppointmentShares,
  revokeGrant,
  getDoctorAppointmentSharedHistory,
};
