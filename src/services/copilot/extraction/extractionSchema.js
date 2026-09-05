/**
 * Zod schema for LLM structured symptom extraction.
 * LLM output is informational only — never authoritative for emergency.
 */

const { z } = require('zod');

const SymptomEntityExtractionSchema = z.object({
  chiefComplaint: z.string().nullable().default(null),
  durationHours: z.number().nullable().default(null),
  severityScale: z
    .number()
    .nullable()
    .default(null)
    .transform((v) => {
      if (v == null || Number.isNaN(v)) return null;
      return Math.max(1, Math.min(10, Math.round(v)));
    }),
  associatedSymptoms: z.array(z.string()).default([]),
  bodySite: z.string().nullable().default(null),
  onset: z.enum(['sudden', 'gradual', 'unknown']).default('unknown'),
  requestedIntent: z
    .enum([
      'triage',
      'exercise',
      'lab_test',
      'doctor_search',
      'pharmacy_search',
      'general_health',
      'unknown',
    ])
    .default('unknown'),
  redFlagsDetected: z.array(z.string()).default([]),
  pregnancyStatus: z
    .enum(['pregnant', 'not_pregnant', 'unknown'])
    .nullable()
    .default('unknown'),
  ageGroup: z.enum(['child', 'adult', 'older_adult', 'unknown']).default('unknown'),
  confidence: z.number().min(0).max(1).default(0.5),
  specialtyHint: z.string().nullable().optional().default(null),
  testHint: z.string().nullable().optional().default(null),
});

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: import('zod').infer<typeof SymptomEntityExtractionSchema> } | { ok: false, error: string }}
 */
function validateExtraction(raw) {
  const parsed = SymptomEntityExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}

module.exports = {
  SymptomEntityExtractionSchema,
  validateExtraction,
};
