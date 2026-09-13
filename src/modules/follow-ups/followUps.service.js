const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const {
  normalizeWeeklySchedule,
  normalizeSlotLabel,
  getSlotAvailabilityForDate,
  buildAppointmentDateTime,
  resolvePaymentStatus,
  normalizePaymentMethod,
} = require('../../utils/telehealth.utils');
const inbox = require('../notifications/inbox.service');

const BOOKABLE = ['planned', 'notified', 'needs_rebooking', 'overdue'];
const WINDOW_PAD_BEFORE_DAYS = 2;
const WINDOW_PAD_AFTER_DAYS = 3;
const NEARBY_SCAN_DAYS = 7;

const followUpInclude = {
  doctor: {
    select: {
      id: true,
      name: true,
      specialty: true,
      photo_url: true,
      fee: true,
      hospital: true,
      slots: true,
    },
  },
  patient: { select: { id: true, name: true, email: true, phone: true } },
  consultation: {
    select: {
      id: true,
      diagnosis: true,
      symptoms: true,
      clinical_notes: true,
      completed_at: true,
      appointment_id: true,
    },
  },
  parent_appointment: {
    select: {
      id: true,
      appointment_date: true,
      slot: true,
      status: true,
      reason: true,
    },
  },
  booked_appointment: {
    select: {
      id: true,
      appointment_date: true,
      slot: true,
      status: true,
      preferred_consultation_mode: true,
      consultation_mode: true,
      payment_status: true,
      fee: true,
    },
  },
};

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function formatDateOnly(value) {
  const d = toDateOnly(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly, days) {
  const d = toDateOnly(dateOnly);
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function encodeSlotId(dateStr, slotLabel) {
  const payload = `${dateStr}|${normalizeSlotLabel(slotLabel)}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeSlotId(slotId) {
  try {
    const raw = Buffer.from(String(slotId || ''), 'base64url').toString('utf8');
    const [dateStr, ...rest] = raw.split('|');
    const slot = rest.join('|');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !slot) return null;
    return { date: dateStr, slot: normalizeSlotLabel(slot) };
  } catch {
    return null;
  }
}

function mapFollowUp(row) {
  if (!row) return null;
  return {
    id: row.id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    consultation_id: row.consultation_id,
    parent_appointment_id: row.parent_appointment_id,
    recommended_date: formatDateOnly(row.recommended_date),
    booking_window: {
      from: formatDateOnly(row.booking_window_start),
      to: formatDateOnly(row.booking_window_end),
    },
    reason: row.reason,
    notes: row.notes,
    preferred_mode: row.preferred_mode,
    priority: row.priority,
    status: row.status,
    booked_appointment_id: row.booked_appointment_id,
    notified_at: row.notified_at,
    reminded_at: row.reminded_at,
    booked_at: row.booked_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    doctor: row.doctor || null,
    patient: row.patient || null,
    consultation: row.consultation || null,
    parent_appointment: row.parent_appointment || null,
    booked_appointment: row.booked_appointment || null,
  };
}

function buildWindow(recommendedDate, windowStart, windowEnd) {
  const recommended = toDateOnly(recommendedDate);
  if (!recommended) throw new AppError('Invalid recommended follow-up date', 400);
  const start = windowStart
    ? toDateOnly(windowStart)
    : addDays(recommended, -WINDOW_PAD_BEFORE_DAYS);
  const end = windowEnd
    ? toDateOnly(windowEnd)
    : addDays(recommended, WINDOW_PAD_AFTER_DAYS);
  if (!start || !end || end < start) {
    throw new AppError('Invalid booking window for follow-up', 400);
  }
  return { recommended, start, end };
}

function resolveRecommendedFromPreset(preset, customDate) {
  if (customDate) return toDateOnly(customDate);
  const map = {
    '3_days': 3,
    '7_days': 7,
    '14_days': 14,
    '30_days': 30,
    none: null,
  };
  if (preset === 'none' || preset === null) return null;
  if (preset && map[preset] != null) return addDays(todayUtcDate(), map[preset]);
  if (preset && /^\d+$/.test(String(preset))) return addDays(todayUtcDate(), Number(preset));
  return null;
}

async function notifyPatientFollowUp(followUp) {
  const doctorName = followUp.doctor?.name || 'Your doctor';
  const dateLabel = formatDateOnly(followUp.recommended_date);
  await inbox.notify({
    recipientType: 'customer',
    recipientId: followUp.patient_id,
    type: 'follow_up_recommended',
    title: 'Follow-up recommended',
    message: `${doctorName} has recommended a follow-up around ${dateLabel}.`,
    link: '/account/appointments?tab=follow-ups',
    data: {
      followUpId: followUp.id,
      doctorId: followUp.doctor_id,
      recommendedDate: dateLabel,
    },
  });
}

async function upsertFollowUpForConsultation(consultationId, payload = {}, { notify = true } = {}) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      appointment: true,
      doctor: { select: { id: true, name: true } },
    },
  });
  if (!consultation) throw new AppError('Consultation not found', 404);

  if (payload.preset === 'none' || payload.clear === true) {
    const existing = await prisma.followUp.findUnique({ where: { consultation_id: consultationId } });
    if (existing && !existing.booked_appointment_id && BOOKABLE.includes(existing.status)) {
      return mapFollowUp(
        await prisma.followUp.update({
          where: { id: existing.id },
          data: { status: 'cancelled' },
          include: followUpInclude,
        }),
      );
    }
    return existing
      ? mapFollowUp(
          await prisma.followUp.findUnique({ where: { id: existing.id }, include: followUpInclude }),
        )
      : null;
  }

  const recommended = resolveRecommendedFromPreset(
    payload.preset,
    payload.recommended_date || payload.follow_up_date,
  );
  if (!recommended) {
    throw new AppError('Select a follow-up date or preset', 400);
  }

  const { start, end } = buildWindow(
    recommended,
    payload.booking_window_start || payload.window_start,
    payload.booking_window_end || payload.window_end,
  );

  const preferredMode = ['online', 'in_clinic', 'in_person', 'either'].includes(payload.preferred_mode)
    ? payload.preferred_mode === 'in_clinic'
      ? 'in_person'
      : payload.preferred_mode
    : 'either';
  const priority = ['routine', 'important', 'urgent'].includes(payload.priority)
    ? payload.priority
    : 'routine';
  const reason = payload.reason || null;
  const notes = payload.notes || payload.follow_up_notes || null;

  const existing = await prisma.followUp.findUnique({
    where: { consultation_id: consultationId },
    include: followUpInclude,
  });

  if (existing?.booked_appointment_id && ['booked', 'completed'].includes(existing.status)) {
    throw new AppError(
      'Follow-up already booked. Reschedule the existing appointment instead of changing the recommendation.',
      409,
    );
  }

  const data = {
    patient_id: consultation.patient_id,
    doctor_id: consultation.doctor_id,
    consultation_id: consultation.id,
    parent_appointment_id: consultation.appointment_id,
    recommended_date: recommended,
    booking_window_start: start,
    booking_window_end: end,
    reason,
    notes,
    preferred_mode: preferredMode,
    priority,
  };

  let row;
  if (existing) {
    row = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        ...data,
        status:
          existing.status === 'cancelled' || existing.status === 'declined'
            ? 'planned'
            : existing.status,
      },
      include: followUpInclude,
    });
  } else {
    row = await prisma.followUp.create({
      data: {
        ...data,
        status: 'planned',
      },
      include: followUpInclude,
    });
  }

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      follow_up_date: recommended,
      follow_up_notes: [reason, notes].filter(Boolean).join(' — ') || notes,
    },
  });

  if (notify && (row.status === 'planned' || !row.notified_at)) {
    try {
      await notifyPatientFollowUp(row);
      row = await prisma.followUp.update({
        where: { id: row.id },
        data: { status: 'notified', notified_at: new Date() },
        include: followUpInclude,
      });
    } catch (err) {
      console.error('follow-up notify failed', err.message);
    }
  }

  return mapFollowUp(row);
}

async function listDoctorFollowUps(doctorId, { status } = {}) {
  const where = { doctor_id: doctorId };
  if (status === 'upcoming') {
    where.status = { in: ['planned', 'notified'] };
  } else if (status === 'overdue') {
    where.status = 'overdue';
  } else if (status === 'booked') {
    where.status = 'booked';
  } else if (status) {
    where.status = status;
  }

  const rows = await prisma.followUp.findMany({
    where,
    include: followUpInclude,
    orderBy: [{ recommended_date: 'asc' }, { created_at: 'desc' }],
  });
  return rows.map(mapFollowUp);
}

async function listPatientFollowUps(patientId, { status } = {}) {
  const where = { patient_id: patientId };
  if (status === 'planned') {
    where.status = { in: BOOKABLE };
  } else if (status === 'booked') {
    where.status = 'booked';
  } else if (status) {
    where.status = status;
  } else {
    where.status = { notIn: ['cancelled', 'declined'] };
  }

  const rows = await prisma.followUp.findMany({
    where,
    include: followUpInclude,
    orderBy: [{ recommended_date: 'asc' }, { created_at: 'desc' }],
  });
  return rows.map(mapFollowUp);
}

async function getFollowUpForDoctor(doctorId, followUpId) {
  const row = await prisma.followUp.findFirst({
    where: { id: followUpId, doctor_id: doctorId },
    include: followUpInclude,
  });
  if (!row) throw new AppError('Follow-up not found', 404);
  return mapFollowUp(row);
}

async function getFollowUpForPatient(patientId, followUpId) {
  const row = await prisma.followUp.findFirst({
    where: { id: followUpId, patient_id: patientId },
    include: followUpInclude,
  });
  if (!row) throw new AppError('Follow-up not found', 404);
  return mapFollowUp(row);
}

async function getBookedSlotsForDate(doctorId, dateValue, tx = prisma) {
  const day = toDateOnly(dateValue);
  const next = addDays(day, 1);
  const appointments = await tx.doctorAppointment.findMany({
    where: {
      doctor_id: doctorId,
      status: { not: 'cancelled' },
      appointment_date: { gte: day, lt: next },
    },
    select: { slot: true },
  });
  return appointments.map((a) => a.slot);
}

async function slotsForDoctorOnDate(doctor, dateStr) {
  const booked = await getBookedSlotsForDate(doctor.id, dateStr);
  const weekly = normalizeWeeklySchedule(doctor.slots);
  const { slots } = getSlotAvailabilityForDate(weekly, dateStr, booked);
  return slots.map((slot) => ({
    slot_id: encodeSlotId(dateStr, slot),
    slot,
    date: dateStr,
  }));
}

function dateInWindow(dateStr, followUp) {
  const d = toDateOnly(dateStr);
  const from = toDateOnly(followUp.booking_window_start);
  const to = toDateOnly(followUp.booking_window_end);
  return d && from && to && d >= from && d <= to;
}

async function getAvailableSlots(patientId, followUpId) {
  const followUp = await prisma.followUp.findFirst({
    where: { id: followUpId, patient_id: patientId },
    include: { doctor: true },
  });
  if (!followUp) throw new AppError('Follow-up not found', 404);
  if (followUp.booked_appointment_id) {
    throw new AppError('Follow-up already booked', 409);
  }
  if (!BOOKABLE.includes(followUp.status)) {
    throw new AppError(`Follow-up cannot be booked while status is ${followUp.status}`, 400);
  }

  const recommended = formatDateOnly(followUp.recommended_date);
  const recommendedSlots = dateInWindow(recommended, followUp)
    ? await slotsForDoctorOnDate(followUp.doctor, recommended)
    : [];

  const nearby = [];
  const start = toDateOnly(followUp.booking_window_start);
  const end = toDateOnly(followUp.booking_window_end);
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dateStr = formatDateOnly(cursor);
    if (dateStr === recommended) continue;
    const daySlots = await slotsForDoctorOnDate(followUp.doctor, dateStr);
    if (daySlots.length) {
      nearby.push({ date: dateStr, slots: daySlots });
    }
    if (nearby.length >= NEARBY_SCAN_DAYS) break;
  }

  return {
    follow_up_id: followUp.id,
    recommended_date: recommended,
    booking_window: {
      from: formatDateOnly(followUp.booking_window_start),
      to: formatDateOnly(followUp.booking_window_end),
    },
    preferred_mode: followUp.preferred_mode,
    recommended_date_slots: recommendedSlots,
    nearby_dates: nearby,
  };
}

async function bookFollowUp(patientId, followUpId, { slot_id, mode, payment_method } = {}) {
  const decoded = decodeSlotId(slot_id);
  if (!decoded) throw new AppError('Invalid slot_id', 400);

    const preferredMode =
      mode === 'in_clinic' || mode === 'in_person'
        ? 'in_person'
        : mode === 'online'
          ? 'online'
          : null;

  return prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.findFirst({
      where: { id: followUpId, patient_id: patientId },
      include: { doctor: true, consultation: true },
    });
    if (!followUp) throw new AppError('Follow-up not found', 404);

    if (followUp.booked_appointment_id) {
      throw new AppError('Follow-up already booked', 409);
    }
    if (!BOOKABLE.includes(followUp.status)) {
      throw new AppError(`Follow-up cannot be booked while status is ${followUp.status}`, 400);
    }
    if (!dateInWindow(decoded.date, followUp)) {
      throw new AppError('Selected slot is outside the follow-up booking window', 400);
    }

    let resolvedMode = preferredMode;
    const followPreferred = followUp.preferred_mode === 'in_clinic' ? 'in_person' : followUp.preferred_mode;
    if (!resolvedMode) {
      if (followPreferred === 'online') resolvedMode = 'online';
      else if (followPreferred === 'in_person') resolvedMode = 'in_person';
      else resolvedMode = 'online';
    }
    if (followPreferred === 'online' && resolvedMode !== 'online') {
      throw new AppError('This follow-up requires an online consultation', 400);
    }
    if (followPreferred === 'in_person' && resolvedMode !== 'in_person') {
      throw new AppError('This follow-up requires an in-clinic consultation', 400);
    }

    const paymentMethodRaw = String(
      payment_method || (resolvedMode === 'online' ? 'stripe' : 'pay_at_clinic'),
    ).toLowerCase();
    const paymentMethod = normalizePaymentMethod(paymentMethodRaw) || paymentMethodRaw;
    if (resolvedMode === 'online' && paymentMethod !== 'stripe') {
      throw new AppError('Online consultations require card payment', 400);
    }

    const booked = await getBookedSlotsForDate(followUp.doctor_id, decoded.date, tx);
    if (booked.map(normalizeSlotLabel).includes(decoded.slot)) {
      throw new AppError('Selected slot was just taken', 409);
    }

    const weekly = normalizeWeeklySchedule(followUp.doctor.slots);
    const { slots } = getSlotAvailabilityForDate(weekly, decoded.date, booked);
    if (!slots.map(normalizeSlotLabel).includes(decoded.slot)) {
      throw new AppError('Selected slot is not available', 409);
    }

    const appointmentDate = buildAppointmentDateTime(decoded.date, decoded.slot);
    const appointment = await tx.doctorAppointment.create({
      data: {
        doctor_id: followUp.doctor_id,
        customer_id: followUp.patient_id,
        slot: decoded.slot,
        appointment_date: appointmentDate,
        fee: followUp.doctor.fee,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: resolvePaymentStatus(paymentMethod),
        reason: followUp.reason || followUp.notes || 'Follow-up consultation',
        preferred_consultation_mode: resolvedMode,
        appointment_type: 'follow_up',
        parent_appointment_id: followUp.parent_appointment_id,
      },
    });

    const updated = await tx.followUp.update({
      where: { id: followUp.id },
      data: {
        status: 'booked',
        booked_appointment_id: appointment.id,
        booked_at: new Date(),
      },
      include: followUpInclude,
    });

    return {
      follow_up: mapFollowUp(updated),
      appointment,
    };
  });
}

async function remindFollowUp(doctorId, followUpId) {
  const row = await prisma.followUp.findFirst({
    where: { id: followUpId, doctor_id: doctorId },
    include: followUpInclude,
  });
  if (!row) throw new AppError('Follow-up not found', 404);
  if (row.booked_appointment_id) throw new AppError('Follow-up already booked', 400);

  await notifyPatientFollowUp(row);
  const updated = await prisma.followUp.update({
    where: { id: row.id },
    data: {
      reminded_at: new Date(),
      status: row.status === 'planned' ? 'notified' : row.status,
      notified_at: row.notified_at || new Date(),
    },
    include: followUpInclude,
  });
  return mapFollowUp(updated);
}

async function cancelFollowUp(doctorId, followUpId) {
  const row = await prisma.followUp.findFirst({
    where: { id: followUpId, doctor_id: doctorId },
  });
  if (!row) throw new AppError('Follow-up not found', 404);
  if (row.status === 'completed') throw new AppError('Completed follow-up cannot be cancelled', 400);

  const updated = await prisma.followUp.update({
    where: { id: row.id },
    data: { status: 'cancelled' },
    include: followUpInclude,
  });
  return mapFollowUp(updated);
}

async function declineFollowUp(patientId, followUpId, reason) {
  const row = await prisma.followUp.findFirst({
    where: { id: followUpId, patient_id: patientId },
  });
  if (!row) throw new AppError('Follow-up not found', 404);
  if (row.booked_appointment_id) throw new AppError('Follow-up already booked', 400);

  const updated = await prisma.followUp.update({
    where: { id: row.id },
    data: {
      status: 'declined',
      notes: reason ? `${row.notes || ''}\nDeclined: ${reason}`.trim() : row.notes,
    },
    include: followUpInclude,
  });
  return mapFollowUp(updated);
}

async function markFollowUpCompletedForAppointment(appointmentId) {
  const followUp = await prisma.followUp.findFirst({
    where: { booked_appointment_id: appointmentId },
  });
  if (!followUp) return null;
  return prisma.followUp.update({
    where: { id: followUp.id },
    data: { status: 'completed', completed_at: new Date() },
  });
}

async function markFollowUpNeedsRebooking(appointmentId) {
  const followUp = await prisma.followUp.findFirst({
    where: { booked_appointment_id: appointmentId },
    include: {
      doctor: { select: { name: true } },
    },
  });
  if (!followUp) return null;
  const updated = await prisma.followUp.update({
    where: { id: followUp.id },
    data: {
      status: 'needs_rebooking',
      booked_appointment_id: null,
      booked_at: null,
    },
  });
  try {
    const inboxEvents = require('../notifications/inbox.events');
    await inboxEvents.followUpNeedsRebooking({
      followUp: updated,
      doctorName: followUp.doctor?.name,
    });
  } catch (err) {
    console.error('follow-up needs rebooking notify failed', err.message);
  }
  return updated;
}

async function markOverdueFollowUps() {
  const today = todayUtcDate();
  const result = await prisma.followUp.updateMany({
    where: {
      booked_appointment_id: null,
      status: { in: ['planned', 'notified', 'needs_rebooking'] },
      booking_window_end: { lt: today },
    },
    data: { status: 'overdue' },
  });
  return { updated: result.count };
}

module.exports = {
  upsertFollowUpForConsultation,
  listDoctorFollowUps,
  listPatientFollowUps,
  getFollowUpForDoctor,
  getFollowUpForPatient,
  getAvailableSlots,
  bookFollowUp,
  remindFollowUp,
  cancelFollowUp,
  declineFollowUp,
  markFollowUpCompletedForAppointment,
  markFollowUpNeedsRebooking,
  markOverdueFollowUps,
  encodeSlotId,
  decodeSlotId,
  mapFollowUp,
};
