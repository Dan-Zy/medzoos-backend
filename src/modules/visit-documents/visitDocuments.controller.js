const catchAsync = require('../../utils/catchAsync');
const { sendResponse } = require('../../utils/response');
const visitDocumentsService = require('./visitDocuments.service');

const listPatientDocuments = catchAsync(async (req, res) => {
  const documents = await visitDocumentsService.listForAppointment(req.params.appointmentId, {
    patientId: req.user.id,
  });
  sendResponse(res, 200, { documents }, 'Visit documents fetched');
});

const createPatientDocument = catchAsync(async (req, res) => {
  const document = await visitDocumentsService.createDirectUpload(
    req.params.appointmentId,
    { id: req.user.id, role: 'customer' },
    req.body,
  );
  sendResponse(res, 201, { document }, 'Visit document added');
});

const createFromRecord = catchAsync(async (req, res) => {
  const document = await visitDocumentsService.createFromMedicalRecord(
    req.params.appointmentId,
    req.user.id,
    req.body,
  );
  sendResponse(res, 201, { document }, 'Medical record linked to visit');
});

const removePatientDocument = catchAsync(async (req, res) => {
  const document = await visitDocumentsService.removeDocument(
    req.params.appointmentId,
    req.params.documentId,
    { patientId: req.user.id },
  );
  sendResponse(res, 200, { document }, 'Visit document removed');
});

const listDoctorDocuments = catchAsync(async (req, res) => {
  const documents = await visitDocumentsService.listForAppointment(req.params.appointmentId, {
    doctorId: req.user.id,
  });
  sendResponse(res, 200, { documents }, 'Visit documents fetched');
});

const createDoctorDocument = catchAsync(async (req, res) => {
  const document = await visitDocumentsService.createDirectUpload(
    req.params.appointmentId,
    { id: req.user.id, role: 'doctor' },
    req.body,
  );
  sendResponse(res, 201, { document }, 'Visit document added');
});

const removeDoctorDocument = catchAsync(async (req, res) => {
  const document = await visitDocumentsService.removeDocument(
    req.params.appointmentId,
    req.params.documentId,
    { doctorId: req.user.id },
  );
  sendResponse(res, 200, { document }, 'Visit document removed');
});

module.exports = {
  listPatientDocuments,
  createPatientDocument,
  createFromRecord,
  removePatientDocument,
  listDoctorDocuments,
  createDoctorDocument,
  removeDoctorDocument,
};
