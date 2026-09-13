const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');

const DOCUMENT_TYPES = [
  'lab_report',
  'imaging',
  'previous_prescription',
  'referral',
  'medical_report',
  'discharge_summary',
  'other',
];

const ATTACHMENT_TYPE_MAP = {
  lab_report: 'lab_report',
  prescription: 'previous_prescription',
  pdf: 'other',
  image: 'imaging',
  medical_image: 'imaging',
};

function mapDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    appointment_id: row.appointment_id,
    consultation_id: row.consultation_id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    uploaded_by_type: row.uploaded_by_type,
    uploaded_by_id: row.uploaded_by_id,
    document_type: row.document_type,
    source: row.source,
    file_name: row.file_name,
    file_url: row.file_url,
    mime_type: row.mime_type,
    file_size: row.file_size,
    title: row.title,
    description: row.description,
    status: row.status,
    chat_message_id: row.chat_message_id,
    medical_document_id: row.medical_document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeDocumentType(value, fallback = 'other') {
  const raw = String(value || '').toLowerCase();
  if (DOCUMENT_TYPES.includes(raw)) return raw;
  if (ATTACHMENT_TYPE_MAP[raw]) return ATTACHMENT_TYPE_MAP[raw];
  return fallback;
}

async function getAppointmentOrThrow(appointmentId) {
  const appointment = await prisma.doctorAppointment.findUnique({
    where: { id: appointmentId },
    include: { consultation: { select: { id: true } } },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);
  return appointment;
}

async function assertPatientOwns(appointment, patientId) {
  if (appointment.customer_id !== patientId) {
    throw new AppError('You do not have access to this appointment', 403);
  }
}

async function assertDoctorOwns(appointment, doctorId) {
  if (appointment.doctor_id !== doctorId) {
    throw new AppError('You do not have access to this appointment', 403);
  }
}

async function listForAppointment(appointmentId, { patientId, doctorId } = {}) {
  const appointment = await getAppointmentOrThrow(appointmentId);
  if (patientId) await assertPatientOwns(appointment, patientId);
  if (doctorId) await assertDoctorOwns(appointment, doctorId);

  const rows = await prisma.visitDocument.findMany({
    where: { appointment_id: appointmentId, status: 'active' },
    orderBy: { created_at: 'desc' },
  });
  return rows.map(mapDocument);
}

async function createDirectUpload(appointmentId, actor, payload = {}) {
  const appointment = await getAppointmentOrThrow(appointmentId);
  const isDoctor = actor.role === 'doctor';
  if (isDoctor) await assertDoctorOwns(appointment, actor.id);
  else await assertPatientOwns(appointment, actor.id);

  if (!payload.file_url) throw new AppError('file_url is required', 400);

  const row = await prisma.visitDocument.create({
    data: {
      appointment_id: appointment.id,
      consultation_id: appointment.consultation?.id || null,
      patient_id: appointment.customer_id,
      doctor_id: appointment.doctor_id,
      uploaded_by_type: isDoctor ? 'doctor' : 'patient',
      uploaded_by_id: actor.id,
      document_type: normalizeDocumentType(payload.document_type),
      source: isDoctor ? 'doctor_upload' : 'direct_upload',
      file_name: payload.file_name || null,
      file_url: payload.file_url,
      mime_type: payload.mime_type || null,
      file_size: payload.file_size != null ? Number(payload.file_size) : null,
      title: payload.title || payload.file_name || 'Visit document',
      description: payload.description || null,
      status: 'active',
    },
  });
  return mapDocument(row);
}

async function createFromMedicalRecord(appointmentId, patientId, { record_id } = {}) {
  if (!record_id) throw new AppError('record_id is required', 400);
  const appointment = await getAppointmentOrThrow(appointmentId);
  await assertPatientOwns(appointment, patientId);

  const record = await prisma.medicalDocument.findFirst({
    where: { id: record_id, patient_id: patientId },
  });
  if (!record) throw new AppError('Medical record not found', 404);
  if (!record.file_url) throw new AppError('Medical record has no file', 400);

  const existing = await prisma.visitDocument.findFirst({
    where: {
      appointment_id: appointmentId,
      medical_document_id: record.id,
      status: 'active',
    },
  });
  if (existing) return mapDocument(existing);

  const row = await prisma.visitDocument.create({
    data: {
      appointment_id: appointment.id,
      consultation_id: appointment.consultation?.id || null,
      patient_id: appointment.customer_id,
      doctor_id: appointment.doctor_id,
      uploaded_by_type: 'patient',
      uploaded_by_id: patientId,
      document_type: normalizeDocumentType(record.document_type, 'other'),
      source: 'medical_vault',
      file_name: record.title || null,
      file_url: record.file_url,
      title: record.title || 'Medical record',
      description: record.notes || null,
      status: 'active',
      medical_document_id: record.id,
    },
  });
  return mapDocument(row);
}

/**
 * Link an existing chat attachment URL to the visit — no file re-upload.
 */
async function linkFromChatAttachment({
  appointmentId,
  actor,
  attachmentUrl,
  messageType,
  chatMessageId,
  fileName,
}) {
  if (!attachmentUrl) return null;
  const appointment = await getAppointmentOrThrow(appointmentId);

  if (chatMessageId) {
    const existing = await prisma.visitDocument.findFirst({
      where: { chat_message_id: chatMessageId, status: 'active' },
    });
    if (existing) return mapDocument(existing);
  }

  const dup = await prisma.visitDocument.findFirst({
    where: {
      appointment_id: appointmentId,
      file_url: attachmentUrl,
      source: 'chat',
      status: 'active',
    },
  });
  if (dup) return mapDocument(dup);

  const isDoctor = actor?.role === 'doctor';
  const row = await prisma.visitDocument.create({
    data: {
      appointment_id: appointment.id,
      consultation_id: appointment.consultation?.id || null,
      patient_id: appointment.customer_id,
      doctor_id: appointment.doctor_id,
      uploaded_by_type: isDoctor ? 'doctor' : 'patient',
      uploaded_by_id: actor?.id || appointment.customer_id,
      document_type: normalizeDocumentType(messageType, 'other'),
      source: 'chat',
      file_name: fileName || null,
      file_url: attachmentUrl,
      title: fileName || 'Chat attachment',
      status: 'active',
      chat_message_id: chatMessageId || null,
    },
  });
  return mapDocument(row);
}

async function removeDocument(appointmentId, documentId, { patientId, doctorId } = {}) {
  const appointment = await getAppointmentOrThrow(appointmentId);
  if (patientId) await assertPatientOwns(appointment, patientId);
  if (doctorId) await assertDoctorOwns(appointment, doctorId);

  const doc = await prisma.visitDocument.findFirst({
    where: { id: documentId, appointment_id: appointmentId },
  });
  if (!doc) throw new AppError('Document not found', 404);

  if (patientId && doc.uploaded_by_type !== 'patient') {
    throw new AppError('You can only remove documents you uploaded', 403);
  }

  const updated = await prisma.visitDocument.update({
    where: { id: doc.id },
    data: { status: 'removed' },
  });
  return mapDocument(updated);
}

module.exports = {
  DOCUMENT_TYPES,
  listForAppointment,
  createDirectUpload,
  createFromMedicalRecord,
  linkFromChatAttachment,
  removeDocument,
};
