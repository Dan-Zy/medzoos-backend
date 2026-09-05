/**
 * Centralized Medical Taxonomy Validator & Multilingual Resolver
 *
 * Rules:
 * - Never allow arbitrary LLM-generated domains or topics into the system.
 * - Server validates all knowledge taxonomy tags before storage and during query routing.
 * - Supports extensible addition of future domains (hypertension, cardiology, etc.).
 */

const diabetes = require('./diabetesTaxonomy');
const mentalHealth = require('./mentalHealthTaxonomy');
const generalHealth = require('./generalHealthTaxonomy');

const DOMAIN_REGISTRY = {
  [diabetes.DOMAIN]: diabetes,
  [mentalHealth.DOMAIN]: mentalHealth,
  [generalHealth.DOMAIN]: generalHealth,
};

const VALID_DOMAINS = Object.keys(DOMAIN_REGISTRY);

/**
 * Check if a domain is registered and valid.
 * @param {string} domain
 * @returns {boolean}
 */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  return VALID_DOMAINS.includes(domain.trim().toLowerCase());
}

/**
 * Check if a topic exists within a given domain.
 * @param {string} domain
 * @param {string} topic
 * @returns {boolean}
 */
function isValidTopic(domain, topic) {
  if (!isValidDomain(domain) || !topic) return false;
  const d = DOMAIN_REGISTRY[domain.trim().toLowerCase()];
  return Boolean(d.TOPICS[topic.trim().toLowerCase()]);
}

/**
 * Check if a subtopic exists within a domain and topic.
 * @param {string} domain
 * @param {string} topic
 * @param {string} subtopic
 * @returns {boolean}
 */
function isValidSubtopic(domain, topic, subtopic) {
  if (!isValidTopic(domain, topic)) return false;
  if (!subtopic) return true; // subtopic is optional
  const d = DOMAIN_REGISTRY[domain.trim().toLowerCase()];
  const t = d.TOPICS[topic.trim().toLowerCase()];
  return (t.subtopics || []).includes(subtopic.trim().toLowerCase());
}

/**
 * Strictly validate a taxonomy payload for document ingestion or knowledge indexing.
 * @param {object} payload
 * @param {string} payload.domain
 * @param {string} [payload.subdomain]
 * @param {string} payload.topic
 * @param {string} [payload.subtopic]
 * @returns {{ valid: boolean, errors: string[], normalized: object|null }}
 */
function validateTaxonomyPayload(payload = {}) {
  const errors = [];
  const domain = String(payload.domain || '').trim().toLowerCase();
  const topic = String(payload.topic || '').trim().toLowerCase();
  const subdomain = payload.subdomain ? String(payload.subdomain).trim().toLowerCase() : null;
  const subtopic = payload.subtopic ? String(payload.subtopic).trim().toLowerCase() : null;

  if (!domain) {
    errors.push('Domain is required.');
  } else if (!isValidDomain(domain)) {
    errors.push(`Invalid domain "${domain}". Supported domains: ${VALID_DOMAINS.join(', ')}.`);
  }

  if (!topic) {
    errors.push('Topic is required.');
  } else if (domain && isValidDomain(domain) && !isValidTopic(domain, topic)) {
    const validTopics = DOMAIN_REGISTRY[domain].TOPIC_KEYS.join(', ');
    errors.push(`Invalid topic "${topic}" for domain "${domain}". Supported topics: ${validTopics}.`);
  }

  if (subtopic && domain && topic && isValidTopic(domain, topic)) {
    if (!isValidSubtopic(domain, topic, subtopic)) {
      const validSubtopics = (DOMAIN_REGISTRY[domain].TOPICS[topic].subtopics || []).join(', ');
      errors.push(`Invalid subtopic "${subtopic}" for topic "${topic}". Supported subtopics: ${validSubtopics || 'none'}.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      domain,
      subdomain,
      topic,
      subtopic,
    },
  };
}

/**
 * Resolve domain and topic from raw multilingual user text (English, Urdu, Roman Urdu).
 * @param {string} text
 * @returns {{ domain: string|null, topic: string|null, subtopic: string|null, confidence: number, matchedSynonym: string|null }}
 */
function resolveTaxonomyFromText(text) {
  if (!text || typeof text !== 'string') {
    return { domain: null, topic: null, subtopic: null, confidence: 0, matchedSynonym: null };
  }

  const raw = text.toLowerCase().trim();
  let bestMatch = null;
  let highestWeight = 0;

  // Specific topics have higher clinical specificity than generic overview/basics
  const SPECIFICITY_TIERS = {
    // Top tier: Specific tests, measurements, acute safety, complications
    hba1c: 2.0,
    safety: 2.5,
    panic: 1.8,
    hypoglycemia: 1.8,
    hyperglycemia: 1.8,
    foot_health: 1.8,
    nerve_health: 1.8,
    kidney_health: 1.8,
    eye_health: 1.8,
    blood_glucose: 1.6,
    medications: 1.5,
    nutrition: 1.4,
    exercise: 1.4,
    sleep: 1.4,
    anxiety: 1.4,
    coping: 1.4,
    therapy: 1.4,
    psychiatry: 1.4,
    depression_related_symptoms: 1.4,
    // Baseline/Generic
    basics: 0.8,
    types: 1.0,
    general_health: 0.9,
  };

  for (const [domainName, domainObj] of Object.entries(DOMAIN_REGISTRY)) {
    for (const [topicName, topicObj] of Object.entries(domainObj.TOPICS)) {
      const topicMultiplier = SPECIFICITY_TIERS[topicName] || 1.0;

      // 1. Direct topic key match
      if (raw.includes(topicName.replace(/_/g, ' '))) {
        const weight = topicName.length * 2 * topicMultiplier;
        if (weight > highestWeight) {
          highestWeight = weight;
          bestMatch = {
            domain: domainName,
            topic: topicName,
            subtopic: topicObj.subtopics?.[0] || null,
            confidence: 0.92,
            matchedSynonym: topicName,
          };
        }
      }

      // 2. Synonyms match (Roman Urdu / Urdu / colloquial English)
      for (const synonym of topicObj.synonyms || []) {
        const synNorm = synonym.toLowerCase();
        if (raw.includes(synNorm)) {
          const weight = synNorm.length * 3 * topicMultiplier;
          if (weight > highestWeight) {
            highestWeight = weight;
            bestMatch = {
              domain: domainName,
              topic: topicName,
              subtopic: topicObj.subtopics?.[0] || null,
              confidence: synNorm.length > 6 ? 0.95 : 0.85,
              matchedSynonym: synonym,
            };
          }
        }
      }
    }
  }

  return bestMatch || { domain: null, topic: null, subtopic: null, confidence: 0, matchedSynonym: null };
}

/**
 * Return complete taxonomy tree for all domains.
 * @returns {Array<object>}
 */
function listAllTaxonomies() {
  return VALID_DOMAINS.map((domainKey) => {
    const d = DOMAIN_REGISTRY[domainKey];
    return {
      domain: domainKey,
      topics: Object.values(d.TOPICS).map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        subtopics: t.subtopics || [],
      })),
    };
  });
}

module.exports = {
  DOMAIN_REGISTRY,
  VALID_DOMAINS,
  isValidDomain,
  isValidTopic,
  isValidSubtopic,
  validateTaxonomyPayload,
  resolveTaxonomyFromText,
  listAllTaxonomies,
};
