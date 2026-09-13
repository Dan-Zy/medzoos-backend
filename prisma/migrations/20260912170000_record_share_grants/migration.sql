-- CreateTable
CREATE TABLE IF NOT EXISTS "record_share_grants" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "record_share_id" TEXT,
    "record_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_share_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "record_share_grants_appointment_id_record_type_record_id_key"
  ON "record_share_grants"("appointment_id", "record_type", "record_id");

CREATE INDEX IF NOT EXISTS "record_share_grants_doctor_id_patient_id_appointment_id_idx"
  ON "record_share_grants"("doctor_id", "patient_id", "appointment_id");

CREATE INDEX IF NOT EXISTS "record_share_grants_appointment_id_revoked_at_idx"
  ON "record_share_grants"("appointment_id", "revoked_at");

DO $$ BEGIN
  ALTER TABLE "record_share_grants" ADD CONSTRAINT "record_share_grants_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "doctor_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "record_share_grants" ADD CONSTRAINT "record_share_grants_record_share_id_fkey"
    FOREIGN KEY ("record_share_id") REFERENCES "record_shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
