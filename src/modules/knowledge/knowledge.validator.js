/**
 * Knowledge Module Request Validators (Joi schemas)
 */

const Joi = require('joi');
const { KNOWLEDGE_STATUS, SOURCE_TYPES, SUPPORTED_LANGUAGES } = require('./knowledge.constants');
const { VALID_DOMAINS } = require('../../services/taxonomy');

const uploadDocumentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  domain: Joi.string().valid(...VALID_DOMAINS).required(),
  topic: Joi.string().trim().min(2).max(100).required(),
  subdomain: Joi.string().trim().max(100).allow(null, '').optional(),
  subtopic: Joi.string().trim().max(100).allow(null, '').optional(),
  source_id: Joi.string().uuid().allow(null, '').optional(),
  source_name: Joi.string().trim().max(255).allow(null, '').optional(),
  source_type: Joi.string().valid(...Object.values(SOURCE_TYPES)).default('guideline'),
  source_url: Joi.string().uri().allow(null, '').optional(),
  source_version: Joi.string().trim().max(50).default('1.0'),
  language: Joi.string().valid(...SUPPORTED_LANGUAGES).default('en'),
  summary: Joi.string().trim().max(2000).allow(null, '').optional(),
  raw_content: Joi.string().allow(null, '').optional(), // Optional direct text if no file
});

const createSourceSchema = Joi.object({
  name: Joi.string().trim().min(3).max(255).required(),
  slug: Joi.string().trim().min(2).max(100).required(),
  type: Joi.string().valid(...Object.values(SOURCE_TYPES)).required(),
  publisher: Joi.string().trim().max(255).allow(null, '').optional(),
  url: Joi.string().uri().allow(null, '').optional(),
  license: Joi.string().trim().max(100).allow(null, '').optional(),
  is_verified: Joi.boolean().default(true),
  description: Joi.string().trim().max(2000).allow(null, '').optional(),
});

const queryDocumentsSchema = Joi.object({
  domain: Joi.string().valid(...VALID_DOMAINS).optional(),
  topic: Joi.string().trim().optional(),
  status: Joi.string().valid(...Object.values(KNOWLEDGE_STATUS)).optional(),
  source_id: Joi.string().uuid().optional(),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const updateDocumentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).optional(),
  domain: Joi.string().valid(...VALID_DOMAINS).optional(),
  topic: Joi.string().trim().min(2).max(100).optional(),
  subdomain: Joi.string().trim().max(100).allow(null, '').optional(),
  subtopic: Joi.string().trim().max(100).allow(null, '').optional(),
  summary: Joi.string().trim().max(2000).allow(null, '').optional(),
  keywords: Joi.array().items(Joi.string().trim()).optional(),
  structured_content: Joi.object().optional(),
  raw_content: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(KNOWLEDGE_STATUS)).optional(),
});

const approveDocumentSchema = Joi.object({
  notes: Joi.string().trim().max(1000).allow(null, '').optional(),
  edited_summary: Joi.string().trim().max(2000).optional(),
  edited_title: Joi.string().trim().max(255).optional(),
});

const rejectDocumentSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(1000).required(),
});

const archiveDocumentSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow(null, '').optional(),
});

module.exports = {
  uploadDocumentSchema,
  createSourceSchema,
  queryDocumentsSchema,
  updateDocumentSchema,
  approveDocumentSchema,
  rejectDocumentSchema,
  archiveDocumentSchema,
};
