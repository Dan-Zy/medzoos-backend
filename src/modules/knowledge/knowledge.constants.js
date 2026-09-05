/**
 * Health Knowledge Constants & Status Definitions
 *
 * Safety Rule: Only APPROVED + INDEXED knowledge may be queried by production RAG.
 */

const KNOWLEDGE_STATUS = {
  DRAFT: 'DRAFT',
  PROCESSING: 'PROCESSING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
  INDEXED: 'INDEXED',
};

/**
 * Statuses permissible for production RAG retrieval.
 */
const PRODUCTION_RAG_STATUSES = [
  KNOWLEDGE_STATUS.APPROVED,
  KNOWLEDGE_STATUS.INDEXED,
];

const SOURCE_TYPES = {
  GUIDELINE: 'guideline',
  TEXTBOOK: 'textbook',
  JOURNAL: 'journal',
  CLINICAL_PROTOCOL: 'clinical_protocol',
  HEALTH_AUTHORITY: 'health_authority',
  INSTITUTIONAL: 'institutional',
  UPLOAD: 'upload',
};

const SUPPORTED_LANGUAGES = ['en', 'ur', 'roman_ur'];

const CONTROLLED_DOMAINS = {
  DIABETES: 'diabetes',
  MENTAL_HEALTH: 'mental_health',
  GENERAL_HEALTH: 'general_health',
};

module.exports = {
  KNOWLEDGE_STATUS,
  PRODUCTION_RAG_STATUSES,
  SOURCE_TYPES,
  SUPPORTED_LANGUAGES,
  CONTROLLED_DOMAINS,
};
