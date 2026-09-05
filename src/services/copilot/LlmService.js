/**
 * OpenAI integration for Health Copilot.
 *
 * SAFETY RULES:
 * - LLM may only extract structured entities or polish greeting/wording.
 * - LLM must NEVER set triageLevel, emergency flags, risk scores, actions,
 *   exercise eligibility, lab/protocol selection, or provider lists.
 * - Falls back gracefully when OPENAI_API_KEY is not set.
 */

const OpenAI = require('openai');
const env = require('../../config/env');
const { logger } = require('../../utils/logger');
const { applySafetyGuardrails } = require('./guardrails/ClinicalGuardrailsEngine');
const { detectUserLanguage } = require('./triage/textNormalizer');

let client = null;

function isEnabled() {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

function getClient() {
  if (!isEnabled()) return null;
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are Medzoos Health Copilot for patients in Pakistan.
Rules:
- LANGUAGE REQUIREMENT: You MUST detect and reply in the EXACT language/dialect of the user:
  * If the user writes in Roman English / Roman Urdu (e.g. "kya sugar mein aam kha sakte hain", "mujhe bukhar hai", "list share karo", "kya medzoos safe hai"), you MUST reply in natural, fluent Roman Urdu / Roman English.
  * If the user writes in English, reply in English.
  * If the user writes in Urdu script, reply in Urdu script.
- Never diagnose. Use educational language only.
- Never determine emergency status, triage level, or clinical urgency.
- Never recommend specific prescription medicines.
- Never invent doctor names, lab names, prices, or availability.
- Never explain, compare, or promote other healthcare apps or platforms (including Marham, Oladoc, or similar). If asked, say you only help inside Medzoos and offer Medzoos features.
- When asked what Medzoos is, describe only Medzoos: doctor booking, lab tests, medicines, health records, and educational Health Copilot guidance.
- Be warm and concise.
- Output valid JSON only when asked for JSON.`;

/**
 * @deprecated Prefer ClinicalTriagePipeline + extractSymptoms.
 * Kept for optional wording polish only. Must not override deterministic triage.
 */
async function generateCopilotTurn({ context, session, userMessage, ruleBasedResult }) {
  if (ruleBasedResult?.riskLevel === 'critical' || session?.triageLevel === 'EMERGENCY') {
    return null;
  }
  const openai = getClient();
  if (!openai) return null;

  const payload = {
    patient: {
      name: context.personal?.firstName,
      insights: context.insights,
    },
    session: {
      phase: session.phase,
      intent: session.intent,
    },
    userMessage,
    ruleBased: {
      riskLevel: ruleBasedResult?.riskLevel,
      reasoning: ruleBasedResult?.reasoning,
    },
  };

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Rewrite patient-facing text only. Do not change urgency. Respond JSON: {"text":"...","suggestedReplies":["..."],"reasoning":["..."]}. Context: ${JSON.stringify(payload)}`,
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      text: typeof parsed.text === 'string' ? parsed.text : null,
      suggestedReplies: Array.isArray(parsed.suggestedReplies)
        ? parsed.suggestedReplies.slice(0, 4)
        : undefined,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : undefined,
    };
  } catch (err) {
    logger.warn('OpenAI copilot call failed, using rule-based fallback', {
      error: err.message,
    });
    return null;
  }
}

async function enhanceGreeting(context, baseGreeting) {
  const openai = getClient();
  if (!openai) return baseGreeting;

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Write a 2-4 sentence personalized health greeting for ${context.personal.firstName}. Context: ${JSON.stringify({
            insights: context.insights,
            conditions: context.conditions,
            upcomingAppointments: context.upcomingAppointments,
          })}. End with "How can I help you today?" Plain text only. Do not diagnose or triage.`,
        },
      ],
    });
    return response.choices?.[0]?.message?.content?.trim() || baseGreeting;
  } catch (err) {
    logger.warn('OpenAI greeting failed', { error: err.message });
    return baseGreeting;
  }
}

/**
 * Generate an empathetic, grounded educational response from retrieved medical knowledge chunks.
 *
 * @param {object} params
 * @param {string} params.userMessage
 * @param {string} params.userLanguage - 'en', 'ur', 'roman_ur'
 * @param {Array} params.retrievedChunks - Verified knowledge chunks from RAG
 * @param {object} params.triageResult - Deterministic triage level and safety decisions
 * @param {object} [params.patientContext]
 * @returns {Promise<{ text: string, citations: string[], suggestedReplies?: string[] }>}
 */
async function generateGroundedEducationalResponse({
  userMessage,
  userLanguage = 'en',
  retrievedChunks = [],
  triageResult,
  patientContext = {},
}) {
  const citations = retrievedChunks.map(
    (c) => `${c.source_name || 'Medical Guideline'} (${c.source_version || '2026'})`
  );
  const uniqueCitations = Array.from(new Set(citations));

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      text: triageResult.text,
      citations: [],
      suggestedReplies: triageResult.suggestedReplies,
    };
  }

  const openai = getClient();

  // Deterministic fallback if LLM is unavailable
  if (!openai) {
    const topChunk = retrievedChunks[0];
    const cleanChunkContent = topChunk.content.replace(/^\[Document:.*?\]\n?/m, '').trim();
    const responseText = `${cleanChunkContent}\n\n[Verified Source: ${uniqueCitations.join(', ')}]`;
    return {
      text: responseText,
      citations: uniqueCitations,
      suggestedReplies: triageResult.suggestedReplies,
    };
  }

  const chunkContext = retrievedChunks
    .map(
      (c, idx) =>
        `[Source ${idx + 1}: ${c.source_name} (${c.source_version}) | Section: ${c.section}]\n${c.content}`
    )
    .join('\n\n---\n\n');

  const patientContextBlock = patientContext?.formatForPrompt
    ? patientContext.formatForPrompt()
    : (patientContext?.personal ? `Patient: ${patientContext.personal.name || 'Patient'} | Age: ${patientContext.personal.age || 'N/A'}` : '');

  const userLang = detectUserLanguage(userMessage);
  const langInstruction =
    userLang === 'roman_ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Roman English / Roman Urdu. You MUST reply 100% in natural, fluent Roman Urdu / Roman English (e.g., "Ji haan, diabetes mein...").'
      : userLang === 'ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Urdu script. Reply 100% in Urdu script.'
      : 'CRITICAL LANGUAGE RULE: The user asked in English. Reply in clear, professional English.';

  const groundingPrompt = `You are Medzoos Multilingual Health Copilot for patients in Pakistan.
User Question: "${userMessage}"
${langInstruction}
Triage Safety Level: ${triageResult.triageLevel} (${triageResult.reasonCode})

${patientContextBlock ? `${patientContextBlock}\n` : ''}
VERIFIED MEDICAL KNOWLEDGE (STRICT GROUNDING):
${chunkContext}

RULES:
1. Ground your answer STRICTLY in the provided verified medical knowledge above.
2. If clinical numbers/ranges are discussed (e.g. HbA1c < 7.0%, blood glucose 80-130 mg/dL), quote them accurately from the sources.
3. Be warm, empathetic, and clear.
4. Do NOT diagnose, prescribe specific brand medications, or contradict the safety advice.
5. Do NOT discuss competitor apps (Marham, Oladoc, etc.). Stay inside Medzoos.
6. Conclude with a brief reference to the source guideline (e.g., "[Source: ADA Standards of Care]").
7. Output JSON format: {"text": "...", "suggestedReplies": ["..."]}`;

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: groundingPrompt },
      ],
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) {
      return {
        text: retrievedChunks[0].content,
        citations: uniqueCitations,
        suggestedReplies: triageResult.suggestedReplies,
      };
    }

    const parsed = JSON.parse(raw);
    const candidateText = parsed.text || retrievedChunks[0].content;
    const guarded = applySafetyGuardrails({
      text: candidateText,
      retrievedChunks,
      citations: uniqueCitations,
      triageResult,
    });

    return {
      text: guarded.text,
      citations: guarded.citations,
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
        ? parsed.suggestedReplies.slice(0, 4)
        : triageResult.suggestedReplies,
      guardrailsPassed: guarded.guardrailsPassed,
    };
  } catch (err) {
    logger.warn('Grounded response generation failed, using chunk fallback', {
      error: err.message,
    });
    const fallbackText = `${retrievedChunks[0].content}\n\n[Verified Source: ${uniqueCitations.join(', ')}]`;
    const guarded = applySafetyGuardrails({
      text: fallbackText,
      retrievedChunks,
      citations: uniqueCitations,
      triageResult,
    });
    return {
      text: guarded.text,
      citations: guarded.citations,
      suggestedReplies: triageResult.suggestedReplies,
    };
  }
}

/**
 * Synthesize a natural, verified directory response using live PostgreSQL records.
 * @param {object} params
 * @param {string} params.userMessage
 * @param {object} params.directoryResult
 * @param {object} [params.patientContext]
 * @returns {Promise<{ text: string, suggestedReplies: string[] }>}
 */
async function generateDirectoryResponse({ userMessage, directoryResult, patientContext }) {
  const openai = getClient();
  const rawHospitals = (directoryResult.hospitals || []).map((h) => ({
    name: h.name,
    city: h.city,
    address: h.address,
    phone: h.phone,
    description: h.description,
  }));

  const rawDoctors = (directoryResult.doctors || []).map((d) => ({
    name: d.name,
    specialty: d.specialty,
    hospital: d.hospital || d.hospital_ref?.name,
    city: d.hospital_ref?.city,
    fee: d.fee ? `Rs. ${d.fee}` : 'Consultation available',
    rating: d.rating ? `${d.rating} ★` : undefined,
    experience_years: d.experience_years ? `${d.experience_years} years` : undefined,
    available_today: d.available_today ? 'Available Today' : 'Advance booking',
    slots: d.slots,
  }));

  const rawLabs = (directoryResult.labs || []).map((l) => ({
    name: l.name,
    city: l.city,
    address: l.address,
    phone: l.phone,
    home_collection: l.home_collection ? 'Home Sampling Available' : 'Lab Visit',
    operating_hours: l.operating_hours || 'Open Today',
    collection_areas: l.collection_areas,
  }));

  const rawPharmacies = (directoryResult.pharmacies || []).map((p) => ({
    name: p.business_name,
    city: p.city,
    address: p.address,
    phone: p.phone,
    delivery: p.delivery_enabled ? 'Home Delivery Available' : 'Store Pickup',
    is_open: p.is_open ? 'Open Now' : 'Closed',
  }));

  const userLang = detectUserLanguage(userMessage);
  const langInstruction =
    userLang === 'roman_ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Roman English / Roman Urdu. You MUST reply 100% in natural, fluent Roman Urdu / Roman English (e.g., "Yeh hain verified doctors jo Gulzar Hospital mein available hain... Aap direct booking kar sakte hain").'
      : userLang === 'ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Urdu script. Reply 100% in Urdu script.'
      : 'CRITICAL LANGUAGE RULE: The user asked in English. Reply in clear, professional English.';

  if (!openai) {
    let summary = '';
    if (rawDoctors.length > 0) {
      summary += `Here are registered doctors on Medzoos:\n\n` +
        rawDoctors.map((d) => `• **${d.name}** (${d.specialty}) at ${d.hospital} — Fee: ${d.fee}`).join('\n');
    }
    if (rawHospitals.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered hospitals on Medzoos:\n\n` +
        rawHospitals.map((h) => `• **${h.name}** (${h.city}) — ${h.address || ''} (Phone: ${h.phone || '24/7'})`).join('\n');
    }
    if (rawLabs.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered diagnostic labs on Medzoos:\n\n` +
        rawLabs.map((l) => `• **${l.name}** (${l.city || 'Pakistan'}) — ${l.home_collection} (Phone: ${l.phone || 'Available'})`).join('\n');
    }
    if (rawPharmacies.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered pharmacies on Medzoos:\n\n` +
        rawPharmacies.map((p) => `• **${p.name}** (${p.city || 'Pakistan'}) — ${p.delivery} (Contact: ${p.phone || 'Available'})`).join('\n');
    }
    summary += `\n\nYou can book appointments, diagnostic tests, or order medicines directly using the options below.`;
    return {
      text: summary,
      suggestedReplies: ['Book appointment', 'Book lab test', 'Order medicine'],
    };
  }

  const prompt = `You are Medzoos Healthcare Assistant in Pakistan.
User Query: "${userMessage}"
${langInstruction}

REAL-TIME REGISTERED DATABASE RECORDS (MEDZOOS PARTNERS):
${JSON.stringify({ hospitals: rawHospitals, doctors: rawDoctors, labs: rawLabs, pharmacies: rawPharmacies }, null, 2)}

INSTRUCTIONS:
1. Provide a warm, clear, and well-structured answer presenting the matching doctors, hospitals, diagnostic labs, and/or partner pharmacies registered in our database above.
2. For informational questions about a city/area, give helpful local context while highlighting that these specific verified providers are officially registered on Medzoos.
3. List doctor names, their specialties, hospital affiliations, consultation fees, and available timings.
4. List hospital names, cities, addresses, and contact numbers.
5. List diagnostic labs and home sample collection capabilities if relevant.
6. List partner pharmacies and medicine delivery availability if relevant.
7. Let the user know they can book appointments, request home lab sampling, or order medicines directly through Medzoos using the action cards below.
8. Output JSON format: {"text": "...", "suggestedReplies": ["..."]}`;

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const parsed = JSON.parse(raw);
    return {
      text: parsed.text,
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
        ? parsed.suggestedReplies.slice(0, 4)
        : ['Book an appointment', 'Book lab test', 'Order medicine'],
    };
  } catch (err) {
    logger.warn('LLM directory response generation failed, using structured fallback', {
      error: err.message,
    });
    let summary = '';
    if (rawDoctors.length > 0) {
      summary += `Here are the registered doctors available on Medzoos:\n\n` +
        rawDoctors.map((d) => `• **${d.name}** — ${d.specialty} (${d.hospital || 'Hospital'}) | Fee: ${d.fee}`).join('\n');
    }
    if (rawHospitals.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered hospitals on Medzoos:\n\n` +
        rawHospitals.map((h) => `• **${h.name}** (${h.city}) — ${h.address || ''} | Contact: ${h.phone || 'Available'}`).join('\n');
    }
    if (rawLabs.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered labs on Medzoos:\n\n` +
        rawLabs.map((l) => `• **${l.name}** (${l.city || 'Pakistan'}) — ${l.home_collection}`).join('\n');
    }
    if (rawPharmacies.length > 0) {
      if (summary) summary += '\n\n';
      summary += `Here are registered pharmacies on Medzoos:\n\n` +
        rawPharmacies.map((p) => `• **${p.name}** (${p.city || 'Pakistan'}) — ${p.delivery}`).join('\n');
    }
    summary += `\n\nYou can book an appointment, schedule lab tests, or order medicines using the action cards below.`;
    return {
      text: summary,
      suggestedReplies: ['Book appointment', 'Book lab test', 'Order medicine'],
    };
  }
}

/**
 * Automatically handle general conversational, platform, wellness, and health questions.
 * @param {object} params
 * @param {string} params.userMessage
 * @param {object} [params.patientContext]
 * @returns {Promise<{ text: string, suggestedReplies: string[] }>}
 */
async function generateConversationalResponse({ userMessage, patientContext }) {
  const openai = getClient();
  if (!openai) {
    return {
      text: "Yes, Medzoos is a secure healthcare platform in Pakistan. We protect your medical data with end-to-end encryption, maintain confidential digital health records, and connect you exclusively with verified licensed doctors, accredited laboratories, and approved pharmacies.",
      suggestedReplies: ['Find a doctor', 'Book a test', 'Ask a health question'],
    };
  }

  const userLang = detectUserLanguage(userMessage);
  const langInstruction =
    userLang === 'roman_ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Roman English / Roman Urdu. You MUST reply 100% in natural, fluent Roman Urdu / Roman English (e.g., "Ji haan, Medzoos aik bilkul secure healthcare platform hai...").'
      : userLang === 'ur'
      ? 'CRITICAL LANGUAGE RULE: The user asked in Urdu script. Reply 100% in Urdu script.'
      : 'CRITICAL LANGUAGE RULE: The user asked in English. Reply in clear, professional English.';

  const prompt = `You are Medzoos AI Health Copilot — a state-of-the-art digital healthcare assistant in Pakistan.
User Message: "${userMessage}"
${langInstruction}

PLATFORM CONTEXT & KNOWLEDGE:
- Medzoos is a comprehensive, highly secure digital health platform in Pakistan.
- Security & Privacy: Medzoos uses bank-grade encryption, HIPAA-standard privacy safeguards, secure digital health records, and strict data confidentiality. Patient health information is never shared with unauthorized third parties.
- Healthcare Ecosystem: Medzoos connects patients with verified licensed doctors (teleconsultation and clinic visits), accredited diagnostic laboratories (with 24/7 home sample collection), and licensed pharmacies (with prescription doorstep delivery).
- Capabilities: Medzoos provides symptom triage, health education, doctor booking, lab test scheduling, medicine ordering, and health records management.
- Tone: Warm, intelligent, concise, professional, reassuring, and helpful.

INSTRUCTIONS:
1. Answer the user's message directly, accurately, and naturally in the requested language.
2. If they ask about platform security, privacy, features, or how Medzoos works, give a confident, clear, and reassuring explanation.
3. If they greet you (e.g. "hi", "hello", "salam", "assalam o alaikum"), greet them warmly and offer assistance.
4. If they ask general health, wellness, diet, or lifestyle questions, provide accurate educational guidance.
5. Output JSON format: {"text": "...", "suggestedReplies": ["..."]}`;

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const parsed = JSON.parse(raw);
    return {
      text: parsed.text,
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
        ? parsed.suggestedReplies.slice(0, 4)
        : ['Find a doctor', 'Book lab test', 'Ask a health question'],
    };
  } catch (err) {
    logger.warn('Conversational response generation failed', { error: err.message });
    return {
      text: "Yes, Medzoos is a secure healthcare platform. We use encrypted medical records and partner only with verified doctors, laboratories, and licensed pharmacies to ensure your data and health are completely safe.",
      suggestedReplies: ['Find a doctor', 'Book a test', 'Order medicine'],
    };
  }
}

module.exports = {
  isEnabled,
  generateCopilotTurn,
  enhanceGreeting,
  generateGroundedEducationalResponse,
  generateDirectoryResponse,
  generateConversationalResponse,
};
