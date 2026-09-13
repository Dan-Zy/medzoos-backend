-- Follow-up care recommendations (separate from consultations and appointments)

ALTER TABLE "doctor_appointments"
  ADD COLUMN IF NOT EXISTS "appointment_type" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "parent_appointment_id" TEXT;

CREATE TABLE IF NOT EXISTS "follow_ups" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "doctor_id" TEXT NOT NULL,
  "consultation_id" TEXT NOT NULL,
  "parent_appointment_id" TEXT,
  "recommended_date" DATE NOT NULL,
  "booking_window_start" DATE NOT NULL,
  "booking_window_end" DATE NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "preferred_mode" TEXT NOT NULL DEFAULT 'either',
  "priority" TEXT NOT NULL DEFAULT 'routine',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "booked_appointment_id" TEXT,
  "notified_at" TIMESTAMP(3),
  "reminded_at" TIMESTAMP(3),
  "booked_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_consultation_id_key" ON "follow_ups"("consultation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_booked_appointment_id_key" ON "follow_ups"("booked_appointment_id");
CREATE INDEX IF NOT EXISTS "follow_ups_patient_id_status_idx" ON "follow_ups"("patient_id", "status");
CREATE INDEX IF NOT EXISTS "follow_ups_doctor_id_status_idx" ON "follow_ups"("doctor_id", "status");
CREATE INDEX IF NOT EXISTS "follow_ups_booking_window_end_status_idx" ON "follow_ups"("booking_window_end", "status");
CREATE INDEX IF NOT EXISTS "doctor_appointments_parent_appointment_id_idx" ON "doctor_appointments"("parent_appointment_id");
CREATE INDEX IF NOT EXISTS "doctor_appointments_appointment_type_status_idx" ON "doctor_appointments"("appointment_type", "status");

DO $$ BEGIN
  ALTER TABLE "doctor_appointments"
    ADD CONSTRAINT "doctor_appointments_parent_appointment_id_fkey"
    FOREIGN KEY ("parent_appointment_id") REFERENCES "doctor_appointments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "follow_ups"
    ADD CONSTRAINT "follow_ups_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "follow_ups"
    ADD CONSTRAINT "follow_ups_doctor_id_fkey"
    FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "follow_ups"
    ADD CONSTRAINT "follow_ups_consultation_id_fkey"
    FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "follow_ups"
    ADD CONSTRAINT "follow_ups_parent_appointment_id_fkey"
    FOREIGN KEY ("parent_appointment_id") REFERENCES "doctor_appointments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "follow_ups"
    ADD CONSTRAINT "follow_ups_booked_appointment_id_fkey"
    FOREIGN KEY ("booked_appointment_id") REFERENCES "doctor_appointments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill FollowUp rows from existing consultation follow-up fields
INSERT INTO "follow_ups" (
  "id",
  "patient_id",
  "doctor_id",
  "consultation_id",
  "parent_appointment_id",
  "recommended_date",
  "booking_window_start",
  "booking_window_end",
  "reason",
  "notes",
  "preferred_mode",
  "priority",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."patient_id",
  c."doctor_id",
  c."id",
  c."appointment_id",
  (c."follow_up_date")::date,
  (c."follow_up_date"::date - INTERVAL '2 day')::date,
  (c."follow_up_date"::date + INTERVAL '3 day')::date,
  NULL,
  c."follow_up_notes",
  'either',
  'routine',
  CASE
    WHEN c."follow_up_date"::date < CURRENT_DATE THEN 'overdue'
    ELSE 'planned'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "consultations" c
WHERE c."follow_up_date" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "follow_ups" f WHERE f."consultation_id" = c."id"
  );
