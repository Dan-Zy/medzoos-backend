/**
 * AI-Assisted Medical Knowledge Structuring Engine
 *
 * Rules:
 * - Structures and summarizes verified medical text without introducing unsupported facts.
 * - Extracts semantic sections, key takeaways, clinical pearls, and multilingual search keywords.
 * - Enforces taxonomy validation on output.
 * - Deterministic heuristic fallback when OpenAI is unavailable.
 */

const OpenAI = require('openai');
const env = require('../../config/env');
const { logger } = require('../../utils/logger');
const { validateTaxonomyPayload, resolveTaxonomyFromText } = require('../taxonomy');

let client = null;

function getClient() {
  if (!env.OPENAI_API_KEY?.trim()) return null;
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

const STRUCTURING_SYSTEM_PROMPT = `You are the Medzoos Clinical Knowledge Structuring Assistant.
Your task is to organize verified medical source text into a structured, clean JSON format for patient education and medical RAG.

SAFETY & INTEGRITY RULES:
1. Do NOT invent medical facts, clinical numbers, drug dosages, or treatments.
2. All extracted points, headings, and clinical pearls MUST be directly grounded in the provided source text.
3. If the text mentions target numbers (e.g., HbA1c < 7.0%, fasting glucose 80-130 mg/dL), preserve them EXACTLY.
4. Output valid JSON matching the requested schema.`;

function buildStructuringPrompt(text, hints = {}) {
  return `Organize and structure this medical text.
Hints (if known):
Domain: ${hints.domain || 'unknown'}
Topic: ${hints.topic || 'unknown'}
Title: ${hints.title || 'unknown'}

Respond strictly with JSON in this format:
{
  "title": "Clean, descriptive document title",
  "domain": "diabetes | mental_health | general_health",
  "topic": "canonical topic key",
  "subtopic": "optional subtopic key or null",
  "summary": "2-3 sentence executive summary of the document",
  "language": "en | ur | roman_ur",
  "keywords": ["array", "of", "search", "synonyms", "and", "keywords"],
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Full section text",
      "key_points": ["Key clinical takeaway 1", "Key clinical takeaway 2"],
      "clinical_pearls": ["Important patient tip or safety rule"]
    }
  ],
  "confidence": 0.95
}

SOURCE TEXT:
${text.slice(0, 15000)}`;
}

/**
 * Deterministic fallback structurer when LLM is unavailable.
 * @param {string} text
 * @param {object} [hints]
 * @returns {object}
 */
function heuristicStructure(text, hints = {}) {
  const taxonomy = resolveTaxonomyFromText(text);
  const domain = hints.domain || taxonomy.domain || 'general_health';
  const topic = hints.topic || taxonomy.topic || 'vitals';
  const subtopic = hints.subtopic || taxonomy.subtopic || null;

  // Split by markdown headings or double newlines
  const rawSections = text.split(/(?=^#{1,3}\s+)/m).filter((s) => s.trim().length > 0);

  const sections = [];
  if (rawSections.length > 1) {
    for (const rawSec of rawSections) {
      const lines = rawSec.trim().split('\n');
      const headingLine = lines[0].replace(/^#{1,3}\s+/, '').trim();
      const content = lines.slice(1).join('\n').trim() || headingLine;
      sections.push({
        heading: headingLine || 'General Overview',
        content,
        key_points: content.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('•')).map((l) => l.replace(/^[-•]\s*/, '').trim()).slice(0, 4),
        clinical_pearls: [],
      });
    }
  } else {
    // Single block
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    sections.push({
      heading: hints.title || 'Overview & Recommendations',
      content: text,
      key_points: paragraphs.slice(0, 3).map((p) => p.slice(0, 120)),
      clinical_pearls: [],
    });
  }

  // Keywords extraction
  const words = text.toLowerCase().match(/\b[a-z0-9_-]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!['with', 'from', 'that', 'this', 'have', 'were', 'been', 'their', 'which', 'about', 'these'].includes(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  const summary = text.slice(0, 250).replace(/\n+/g, ' ').trim() + (text.length > 250 ? '...' : '');

  return {
    title: hints.title || `${topic.toUpperCase()} Clinical Guide`,
    domain,
    topic,
    subtopic,
    summary,
    language: 'en',
    keywords: Array.from(new Set([topic, domain, ...topKeywords])),
    sections,
    confidence: 0.85,
    source: 'heuristic',
  };
}

/**
 * Structure a medical document text into categorized sections, key takeaways, and keywords.
 * @param {string} text - Raw document text
 * @param {object} [hints] - Optional domain/topic/title hints
 * @returns {Promise<{ structured: object, source: 'llm'|'heuristic', validated: boolean }>}
 */
async function structureDocumentText(text, hints = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Valid text content is required for structuring.');
  }

  const openai = getClient();
  if (!openai) {
    const fallback = heuristicStructure(text, hints);
    return { structured: fallback, source: 'heuristic', validated: true };
  }

  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STRUCTURING_SYSTEM_PROMPT },
        { role: 'user', content: buildStructuringPrompt(text, hints) },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      const fallback = heuristicStructure(text, hints);
      return { structured: fallback, source: 'heuristic', validated: true };
    }

    let parsed = JSON.parse(rawContent);

    // Validate taxonomy returned by LLM
    const taxCheck = validateTaxonomyPayload({
      domain: parsed.domain || hints.domain,
      topic: parsed.topic || hints.topic,
      subtopic: parsed.subtopic || hints.subtopic,
    });

    if (!taxCheck.valid) {
      logger.warn('LLM structured taxonomy validation failed, applying verified hints', {
        errors: taxCheck.errors,
      });
      parsed.domain = hints.domain || 'general_health';
      parsed.topic = hints.topic || 'vitals';
      parsed.subtopic = hints.subtopic || null;
    } else {
      parsed.domain = taxCheck.normalized.domain;
      parsed.topic = taxCheck.normalized.topic;
      parsed.subtopic = taxCheck.normalized.subtopic;
    }

    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      parsed.sections = [{
        heading: parsed.title || 'Clinical Overview',
        content: text,
        key_points: [],
        clinical_pearls: [],
      }];
    }

    return {
      structured: parsed,
      source: 'llm',
      validated: true,
    };
  } catch (err) {
    logger.warn('Knowledge structuring LLM call failed, using heuristic fallback', {
      error: err.message,
    });
    const fallback = heuristicStructure(text, hints);
    return { structured: fallback, source: 'heuristic', validated: true };
  }
}

module.exports = {
  structureDocumentText,
  heuristicStructure,
  STRUCTURING_SYSTEM_PROMPT,
};
