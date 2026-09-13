-- AlterTable
ALTER TABLE "doctor_appointments" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "visit_documents" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "uploaded_by_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "file_name" TEXT,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "chat_message_id" TEXT,
    "medical_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visit_documents_appointment_id_status_idx" ON "visit_documents"("appointment_id", "status");
CREATE INDEX IF NOT EXISTS "visit_documents_patient_id_status_idx" ON "visit_documents"("patient_id", "status");
CREATE INDEX IF NOT EXISTS "visit_documents_doctor_id_status_idx" ON "visit_documents"("doctor_id", "status");
CREATE INDEX IF NOT EXISTS "visit_documents_chat_message_id_idx" ON "visit_documents"("chat_message_id");

DO $$ BEGIN
  ALTER TABLE "visit_documents" ADD CONSTRAINT "visit_documents_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "doctor_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_documents" ADD CONSTRAINT "visit_documents_consultation_id_fkey"
    FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_documents" ADD CONSTRAINT "visit_documents_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_documents" ADD CONSTRAINT "visit_documents_doctor_id_fkey"
    FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "visit_documents" ADD CONSTRAINT "visit_documents_medical_document_id_fkey"
    FOREIGN KEY ("medical_document_id") REFERENCES "medical_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
