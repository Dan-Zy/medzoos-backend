const { z } = require('zod');

const bookAppointmentSchema = z.object({
  body: z.object({
    doctor_id: z.string(),
    slot: z.string(),
    appointment_date: z.string().optional(),
    payment_method: z.string().optional(),
    reason: z.string().optional(),
    preferred_consultation_mode: z.enum(['online', 'in_person']).optional(),
    hospital_id: z.string().optional(),
    practice_location_id: z.string().optional(),
    share_records: z
      .union([
        z.boolean(),
        z.object({
          share_prescriptions: z.boolean().optional(),
          share_lab_reports: z.boolean().optional(),
          share_medicines: z.boolean().optional(),
          share_documents: z.boolean().optional(),
        }),
      ])
      .optional(),
    share_grants: z
      .array(
        z.object({
          record_type: z.enum([
            'visit_summary',
            'prescription',
            'lab_report',
            'medical_document',
            'visit_document',
          ]),
          record_id: z.string().min(1),
        }),
      )
      .optional(),
  }),
});

const rescheduleAppointmentSchema = z.object({
  body: z.object({
    slot: z.string().optional(),
    appointment_date: z.string().optional(),
    reason: z.string().optional(),
  }),
});

const submitDoctorReviewSchema = z.object({
  body: z.object({
    appointment_id: z.string(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().optional(),
  }),
});

const updateSlotsSchema = z.object({
  body: z.object({
    slots: z.array(
      z.object({
        day: z.string(),
        slots: z.array(z.string()),
      })
    ),
  }),
});

const selectConsultationModeSchema = z.object({
  body: z.object({
    mode: z.enum(['online', 'in_person']),
  }),
});

module.exports = {
  bookAppointmentSchema,
  rescheduleAppointmentSchema,
  selectConsultationModeSchema,
  submitDoctorReviewSchema,
  updateSlotsSchema,
};
