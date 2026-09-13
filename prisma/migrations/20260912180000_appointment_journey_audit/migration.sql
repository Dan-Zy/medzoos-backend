-- Professional journey audit fields (nullable, additive only)
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "paid_by" TEXT;
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMP(3);
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "checked_in_by" TEXT;
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "no_show_at" TIMESTAMP(3);
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "no_show_marked_by" TEXT;
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "no_show_reason" TEXT;
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "rescheduled_at" TIMESTAMP(3);
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "rescheduled_by" TEXT;

ALTER TABLE "record_share_grants" ADD COLUMN IF NOT EXISTS "revoked_by" TEXT;

CREATE INDEX IF NOT EXISTS "record_share_grants_patient_id_revoked_at_idx"
  ON "record_share_grants"("patient_id", "revoked_at");
