const OpenAI = require('openai');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { TRANSCRIBE_PROMPT } = require('./prompts');
const { structureFromText } = require('./parseStructured');
const { normalizeOcrResult } = require('./normalize');

const SINGLE_PASS_PROMPT = `You are an expert clinical pharmacist and prescription reader specialized in reading printed and handwritten doctor prescriptions (Pakistan / South Asia / International).

Carefully read the entire prescription image (header, patient section, Rx section, investigations, footer).
Read English, Urdu, and Roman Urdu.

Extract the following in JSON:
- doctor: Doctor full name with title (e.g. "Dr. Uzma Babur") or null
- clinic: Hospital, Clinic, or Medical Center name or null
- prescription_date: Date written on prescription (YYYY-MM-DD or formatted string) or null
- diagnosis: Diagnosis, provisional diagnosis, chief complaint, Dx, or indication if written or null
- confidence: "high" | "medium" | "low"
- lab_tests: Array of laboratory tests / investigations / diagnostics written on the Rx (e.g. ["CBC", "LFT", "Blood Group B+"]). Empty array [] if none.
- medicines: Array of prescribed medicine objects. For each medicine:
  - name: Medicine brand or generic name (e.g. "Noridat", "Augmentin", "Panadol", "Riam", "Etik"). Strip generic prefixes like "Tab ", "Cap ", "Syp " unless integral.
  - dose: Strength or dosage form (e.g. "500mg", "1g", "5ml", "1 drop", "Tab 500") or null
  - frequency: Array of timing tokens from ['morning', 'afternoon', 'night'].
    Mapping rules:
    - 1-0-1, BD, BID, twice daily -> ["morning", "night"]
    - 1-1-1, TDS, TID, 3 times daily -> ["morning", "afternoon", "night"]
    - 1-0-0, OD, QD, once daily, morning -> ["morning"]
    - 0-0-1, HS, bedtime, night -> ["night"]
    - 0-1-0, noon, lunch -> ["afternoon"]
    - 0-1-1, 0,1,1 -> ["afternoon", "night"]
    - 1-1-0 -> ["morning", "afternoon"]
    - SOS, PRN, as needed -> ["morning"]
  - instructions: Instructions on how to take (e.g. "After meals", "With water", "Empty stomach") or null
  - duration: Course duration (e.g. "5 days", "1 week", "10 days") or null
  - purpose: Condition or symptom treated (e.g. "Fever", "Infection", "Pain", "Hypertension") or diagnosis or null
  - purpose_source: "prescription" | "inferred" | "unknown"
- raw_text: Full transcription of all text detected on the prescription

Return valid JSON matching this schema:
{
  "doctor": "Dr. ...",
  "clinic": "...",
  "prescription_date": "...",
  "diagnosis": "...",
  "confidence": "high",
  "lab_tests": [],
  "medicines": [
    {
      "name": "...",
      "dose": "...",
      "frequency": ["morning", "night"],
      "instructions": "...",
      "duration": "...",
      "purpose": "...",
      "purpose_source": "prescription"
    }
  ],
  "raw_text": "..."
}`;

function getClient() {
  if (!env.OPENAI_API_KEY?.trim()) return null;
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function getVisionModel() {
  return env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
}

function useTwoPass() {
  const flag = env.PRESCRIPTION_OCR_TWO_PASS;
  return flag === 'true' || flag === '1';
}

async function transcribeImage(client, { base64, mimeType }) {
  const model = getVisionModel();
  const response = await client.chat.completions.create({
    model,
    temperature: 0.05,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIBE_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}

async function extractSinglePass(client, { fileUrl, base64, mimeType }) {
  const model = getVisionModel();
  const response = await client.chat.completions.create({
    model,
    temperature: 0.05,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SINGLE_PASS_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return normalizeOcrResult(parsed, {
    provider: `openai-vision:${model}`,
    source: fileUrl,
    rawText: parsed.raw_text,
  });
}

async function extractWithOpenAiVision({ fileUrl, base64, mimeType }) {
  const client = getClient();
  if (!client) return null;

  const model = getVisionModel();

  try {
    if (useTwoPass()) {
      const transcription = await transcribeImage(client, { base64, mimeType });
      if (!transcription?.raw_text?.trim()) {
        logger.warn('Prescription transcription empty, falling back to single-pass');
        return extractSinglePass(client, { fileUrl, base64, mimeType });
      }

      const structured = await structureFromText({
        rawText: transcription.raw_text,
        diagnosisHint: transcription.diagnosis,
        fileUrl,
        provider: `openai-two-pass:${model}+${env.OPENAI_OCR_PARSE_MODEL || model}`,
      });

      if (structured) return structured;
      return extractSinglePass(client, { fileUrl, base64, mimeType });
    }

    return extractSinglePass(client, { fileUrl, base64, mimeType });
  } catch (err) {
    logger.warn('OpenAI vision prescription OCR failed', { error: err.message });
    throw err;
  }
}

module.exports = { extractWithOpenAiVision };
