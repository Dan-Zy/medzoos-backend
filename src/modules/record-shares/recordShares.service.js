const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');

const RECORD_TYPES = [
  'visit_summary',
  'prescription',
  'lab_report',
  'medical_document',
  'visit_document',
];

const SUMMARY_MAX_CHARS = 280;

function shortSummary(clinicalNotes) {
  if (!clinicalNotes) return null;
  const cleaned = String(clinicalNotes).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.length <= SUMMARY_MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, SUMMARY_MAX_CHARS).trim()}…`;
}

function flagsFromGrantTypes(types = []) {
  const set = new Set(types);
  return {
    share_prescriptions: set.has('prescription'),
    share_lab_reports: set.has('lab_report'),
    share_medicines: set.has('prescription'),
    share_documents:
      set.has('medical_document') || set.has('visit_document') || set.has('visit_summary'),
  };
}

/**
 * Patient-facing catalog of records that can be shared with a doctor.
 * Visit summaries expose diagnosis + short summary only (never full notes).
 */
async function listShareableHistory(patientId) {
  const [consultations, prescriptions, labBookings, medicalDocs, visitDocs] = await Promise.all([
    prisma.consultation.findMany({
      where: {
        patient_id: patientId,
        OR: [{ diagnosis: { not: null } }, { clinical_notes: { not: null } }],
        status: { in: ['completed', 'in_progress', 'scheduled'] },
      },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        appointment: {
          select: {
            id: true,
            appointment_date: true,
            status: true,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
      take: 30,
    }),
    prisma.doctorPrescription.findMany({
      where: { customer_id: patientId, status: { not: 'draft' } },
      include: {
        doctor: { select: { id: true, name: true } },
        appointment: { select: { appointment_date: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 30,
    }),
    prisma.labTestBooking.findMany({
      where: { customer_id: patientId, report_url: { not: null } },
      include: {
        lab_test: { select: { name: true } },
        lab_partner: { select: { name: true } },
      },
      orderBy: { collection_date: 'desc' },
      take: 30,
    }),
    prisma.medicalDocument.findMany({
      where: { patient_id: patientId },
      orderBy: [{ document_date: 'desc' }, { created_at: 'desc' }],
      take: 40,
    }),
    prisma.visitDocument.findMany({
      where: { patient_id: patientId, status: 'active' },
      include: {
        doctor: { select: { name: true } },
        appointment: { select: { appointment_date: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 40,
    }),
  ]);

  const visitSummaries = consultations
    .filter((c) => c.diagnosis || c.clinical_notes)
    .map((c) => ({
      record_type: 'visit_summary',
      record_id: c.id,
      title: c.diagnosis || 'Visit summary',
      diagnosis: c.diagnosis || null,
      summary: shortSummary(c.clinical_notes),
      doctor_name: c.doctor?.name || null,
      doctor_specialty: c.doctor?.specialty || null,
      date: c.appointment?.appointment_date || c.completed_at || c.updated_at,
      appointment_id: c.appointment_id,
    }));

  const prescriptionItems = prescriptions.map((rx) => ({
    record_type: 'prescription',
    record_id: rx.id,
    title: `Prescription from ${rx.doctor?.name ? `Dr. ${rx.doctor.name}` : 'doctor'}`,
    doctor_name: rx.doctor?.name || null,
    date: rx.appointment?.appointment_date || rx.signed_at || rx.created_at,
    items_count: Array.isArray(rx.items) ? rx.items.length : 0,
  }));

  const labItems = [
    ...labBookings.map((b) => ({
      record_type: 'lab_report',
      record_id: `lab:${b.id}`,
      title: b.lab_test?.name || 'Lab report',
      lab_name: b.lab_partner?.name || null,
      date: b.collection_date || b.created_at,
      file_url: b.report_url,
      source: 'lab_booking',
    })),
    ...medicalDocs
      .filter((d) => d.document_type === 'lab_report')
      .map((d) => ({
        record_type: 'lab_report',
        record_id: `doc:${d.id}`,
        title: d.title || 'Lab report',
        lab_name: d.hospital_name || null,
        date: d.document_date || d.created_at,
        file_url: d.file_url,
        source: 'medical_document',
      })),
  ];

  const documentItems = medicalDocs
    .filter((d) => !['lab_report'].includes(d.document_type))
    .map((d) => ({
      record_type: 'medical_document',
      record_id: d.id,
      title: d.title || d.document_type,
      document_type: d.document_type,
      date: d.document_date || d.created_at,
      file_url: d.file_url,
    }));

  const visitDocumentItems = visitDocs.map((d) => ({
    record_type: 'visit_document',
    record_id: d.id,
    title: d.title || d.file_name || d.document_type,
    document_type: d.document_type,
    doctor_name: d.doctor?.name || null,
    date: d.appointment?.appointment_date || d.created_at,
    file_url: d.file_url,
  }));

  return {
    visit_summaries: visitSummaries,
    prescriptions: prescriptionItems,
    lab_reports: labItems,
    medical_documents: documentItems,
    visit_documents: visitDocumentItems,
  };
}

async function assertPatientAppointment(patientId, appointmentId) {
  const appointment = await prisma.doctorAppointment.findFirst({
    where: { id: appointmentId, customer_id: patientId },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);
  return appointment;
}

/**
 * Replace active grants for an appointment with the patient's selection.
 * Also updates legacy RecordShare flags for compatibility.
 */
async function saveAppointmentGrants(patientId, appointmentId, grants = []) {
  const appointment = await assertPatientAppointment(patientId, appointmentId);
  const normalized = (Array.isArray(grants) ? grants : [])
    .map((g) => ({
      record_type: String(g.record_type || '').trim(),
      record_id: String(g.record_id || '').trim(),
    }))
    .filter((g) => RECORD_TYPES.includes(g.record_type) && g.record_id);

  // Dedupe
  const seen = new Set();
  const unique = [];
  for (const g of normalized) {
    const key = `${g.record_type}:${g.record_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(g);
  }

  await validateGrantOwnership(patientId, unique);

  const flags = flagsFromGrantTypes(unique.map((g) => g.record_type));

  return prisma.$transaction(async (tx) => {
    let share = await tx.recordShare.findUnique({ where: { appointment_id: appointmentId } });
    if (!share) {
      share = await tx.recordShare.create({
        data: {
          appointment_id: appointmentId,
          patient_id: patientId,
          doctor_id: appointment.doctor_id,
          ...flags,
        },
      });
    } else {
      share = await tx.recordShare.update({
        where: { id: share.id },
        data: flags,
      });
    }

    await tx.recordShareGrant.deleteMany({
      where: { appointment_id: appointmentId },
    });

    if (unique.length) {
      await tx.recordShareGrant.createMany({
        data: unique.map((g) => ({
          appointment_id: appointmentId,
          patient_id: patientId,
          doctor_id: appointment.doctor_id,
          record_share_id: share.id,
          record_type: g.record_type,
          record_id: g.record_id,
        })),
      });
    }

    const active = await tx.recordShareGrant.findMany({
      where: { appointment_id: appointmentId, revoked_at: null },
      orderBy: { shared_at: 'desc' },
    });

    return {
      record_share: share,
      grants: active,
    };
  });
}

async function validateGrantOwnership(patientId, grants) {
  for (const g of grants) {
    if (g.record_type === 'visit_summary') {
      const row = await prisma.consultation.findFirst({
        where: { id: g.record_id, patient_id: patientId },
        select: { id: true },
      });
      if (!row) throw new AppError('Invalid visit summary selection', 400);
      continue;
    }
    if (g.record_type === 'prescription') {
      const row = await prisma.doctorPrescription.findFirst({
        where: { id: g.record_id, customer_id: patientId },
        select: { id: true },
      });
      if (!row) throw new AppError('Invalid prescription selection', 400);
      continue;
    }
    if (g.record_type === 'lab_report') {
      if (g.record_id.startsWith('lab:')) {
        const id = g.record_id.slice(4);
        const row = await prisma.labTestBooking.findFirst({
          where: { id, customer_id: patientId },
          select: { id: true },
        });
        if (!row) throw new AppError('Invalid lab report selection', 400);
      } else if (g.record_id.startsWith('doc:')) {
        const id = g.record_id.slice(4);
        const row = await prisma.medicalDocument.findFirst({
          where: { id, patient_id: patientId, document_type: 'lab_report' },
          select: { id: true },
        });
        if (!row) throw new AppError('Invalid lab report selection', 400);
      } else {
        throw new AppError('Invalid lab report selection', 400);
      }
      continue;
    }
    if (g.record_type === 'medical_document') {
      const row = await prisma.medicalDocument.findFirst({
        where: { id: g.record_id, patient_id: patientId },
        select: { id: true },
      });
      if (!row) throw new AppError('Invalid medical document selection', 400);
      continue;
    }
    if (g.record_type === 'visit_document') {
      const row = await prisma.visitDocument.findFirst({
        where: { id: g.record_id, patient_id: patientId, status: 'active' },
        select: { id: true },
      });
      if (!row) throw new AppError('Invalid visit document selection', 400);
    }
  }
}

async function resolveGrant(grant) {
  const base = {
    record_type: grant.record_type,
    record_id: grant.record_id,
    shared_at: grant.shared_at,
  };

  if (grant.record_type === 'visit_summary') {
    const c = await prisma.consultation.findUnique({
      where: { id: grant.record_id },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        appointment: { select: { id: true, appointment_date: true } },
      },
    });
    if (!c) return null;
    return {
      ...base,
      diagnosis: c.diagnosis || null,
      summary: shortSummary(c.clinical_notes),
      doctor_name: c.doctor?.name || null,
      doctor_specialty: c.doctor?.specialty || null,
      date: c.appointment?.appointment_date || c.completed_at || c.updated_at,
      // Explicitly omit full clinical_notes
    };
  }

  if (grant.record_type === 'prescription') {
    const rx = await prisma.doctorPrescription.findUnique({
      where: { id: grant.record_id },
      include: {
        doctor: { select: { name: true } },
        appointment: { select: { appointment_date: true } },
      },
    });
    if (!rx) return null;
    return {
      ...base,
      doctor_name: rx.doctor?.name || null,
      date: rx.appointment?.appointment_date || rx.signed_at || rx.created_at,
      items: rx.items,
      notes: rx.notes,
      status: rx.status,
    };
  }

  if (grant.record_type === 'lab_report') {
    if (grant.record_id.startsWith('lab:')) {
      const id = grant.record_id.slice(4);
      const booking = await prisma.labTestBooking.findUnique({
        where: { id },
        include: {
          lab_test: { select: { name: true } },
          lab_partner: { select: { name: true } },
        },
      });
      if (!booking) return null;
      return {
        ...base,
        title: booking.lab_test?.name || 'Lab report',
        lab_name: booking.lab_partner?.name || null,
        date: booking.collection_date,
        file_url: booking.report_url,
      };
    }
    if (grant.record_id.startsWith('doc:')) {
      const id = grant.record_id.slice(4);
      const doc = await prisma.medicalDocument.findUnique({ where: { id } });
      if (!doc) return null;
      return {
        ...base,
        title: doc.title,
        lab_name: doc.hospital_name,
        date: doc.document_date || doc.created_at,
        file_url: doc.file_url,
      };
    }
    return null;
  }

  if (grant.record_type === 'medical_document') {
    const doc = await prisma.medicalDocument.findUnique({ where: { id: grant.record_id } });
    if (!doc) return null;
    return {
      ...base,
      title: doc.title,
      document_type: doc.document_type,
      date: doc.document_date || doc.created_at,
      file_url: doc.file_url,
    };
  }

  if (grant.record_type === 'visit_document') {
    const doc = await prisma.visitDocument.findUnique({
      where: { id: grant.record_id },
      include: { doctor: { select: { name: true } } },
    });
    if (!doc || doc.status !== 'active') return null;
    return {
      ...base,
      title: doc.title || doc.file_name,
      document_type: doc.document_type,
      doctor_name: doc.doctor?.name || null,
      date: doc.created_at,
      file_url: doc.file_url,
    };
  }

  return null;
}

async function getAppointmentSharedHistory(doctorId, appointmentId) {
  const appointment = await prisma.doctorAppointment.findFirst({
    where: { id: appointmentId, doctor_id: doctorId },
    select: {
      id: true,
      customer_id: true,
      doctor_id: true,
      appointment_date: true,
      status: true,
    },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);

  const allGrants = await prisma.recordShareGrant.findMany({
    where: {
      appointment_id: appointmentId,
      doctor_id: doctorId,
      patient_id: appointment.customer_id,
    },
    orderBy: { shared_at: 'desc' },
  });

  const activeGrants = allGrants.filter((g) => !g.revoked_at);
  const revokedOnly = allGrants.length > 0 && activeGrants.length === 0;

  const resolved = [];
  for (const grant of activeGrants) {
    const item = await resolveGrant(grant);
    if (item) resolved.push(item);
  }

  let share_state = 'none';
  if (resolved.length > 0) share_state = 'active';
  else if (revokedOnly) share_state = 'revoked';

  return {
    appointment_id: appointmentId,
    patient_id: appointment.customer_id,
    share_state,
    grant_count: resolved.length,
    visit_summaries: resolved.filter((r) => r.record_type === 'visit_summary'),
    prescriptions: resolved.filter((r) => r.record_type === 'prescription'),
    lab_reports: resolved.filter((r) => r.record_type === 'lab_report'),
    medical_documents: resolved.filter((r) => r.record_type === 'medical_document'),
    visit_documents: resolved.filter((r) => r.record_type === 'visit_document'),
    items: resolved,
  };
}

async function listPatientShareEvents(patientId) {
  const grants = await prisma.recordShareGrant.findMany({
    where: { patient_id: patientId },
    orderBy: { shared_at: 'desc' },
    include: {
      appointment: {
        select: {
          id: true,
          appointment_date: true,
          slot: true,
          status: true,
          consultation_mode: true,
          preferred_consultation_mode: true,
          doctor: { select: { id: true, name: true, specialty: true } },
        },
      },
    },
  });

  const byAppointment = new Map();
  for (const grant of grants) {
    const key = grant.appointment_id;
    if (!byAppointment.has(key)) {
      byAppointment.set(key, {
        appointment_id: grant.appointment_id,
        doctor_id: grant.doctor_id,
        doctor_name: grant.appointment?.doctor?.name || null,
        specialty: grant.appointment?.doctor?.specialty || null,
        appointment_date: grant.appointment?.appointment_date || null,
        slot: grant.appointment?.slot || null,
        appointment_status: grant.appointment?.status || null,
        shared_at: grant.shared_at,
        grants: [],
      });
    }
    const bucket = byAppointment.get(key);
    bucket.grants.push({
      id: grant.id,
      record_type: grant.record_type,
      record_id: grant.record_id,
      shared_at: grant.shared_at,
      revoked_at: grant.revoked_at,
      status: grant.revoked_at ? 'revoked' : 'active',
    });
    if (!grant.revoked_at && (!bucket.shared_at || grant.shared_at < bucket.shared_at)) {
      bucket.shared_at = grant.shared_at;
    }
  }

  const events = Array.from(byAppointment.values()).map((event) => {
    const activeCount = event.grants.filter((g) => g.status === 'active').length;
    const revokedCount = event.grants.filter((g) => g.status === 'revoked').length;
    let status = 'none';
    if (activeCount > 0) status = 'active';
    else if (revokedCount > 0) status = 'revoked';
    return {
      ...event,
      status,
      active_count: activeCount,
      revoked_count: revokedCount,
      record_types: [...new Set(event.grants.map((g) => g.record_type))],
    };
  });

  return { events };
}

async function revokeAppointmentShares(patientId, appointmentId) {
  const appointment = await prisma.doctorAppointment.findFirst({
    where: { id: appointmentId, customer_id: patientId },
    select: { id: true },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);

  const result = await prisma.recordShareGrant.updateMany({
    where: {
      appointment_id: appointmentId,
      patient_id: patientId,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
      revoked_by: patientId,
    },
  });

  return {
    appointment_id: appointmentId,
    revoked_count: result.count,
  };
}

async function revokeGrantById(patientId, grantId) {
  const grant = await prisma.recordShareGrant.findFirst({
    where: { id: grantId, patient_id: patientId },
  });
  if (!grant) throw new AppError('Share grant not found', 404);
  if (grant.revoked_at) {
    return { grant_id: grant.id, already_revoked: true, revoked_at: grant.revoked_at };
  }

  const updated = await prisma.recordShareGrant.update({
    where: { id: grantId },
    data: {
      revoked_at: new Date(),
      revoked_by: patientId,
    },
  });

  return {
    grant_id: updated.id,
    appointment_id: updated.appointment_id,
    revoked_at: updated.revoked_at,
  };
}

module.exports = {
  RECORD_TYPES,
  listShareableHistory,
  saveAppointmentGrants,
  getAppointmentSharedHistory,
  listPatientShareEvents,
  revokeAppointmentShares,
  revokeGrantById,
  flagsFromGrantTypes,
  shortSummary,
};
