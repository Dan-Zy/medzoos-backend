/**
 * Medical Knowledge Module Controller
 */

const catchAsync = require('../../utils/catchAsync');
const { sendResponse } = require('../../utils/response');
const knowledgeService = require('./knowledge.service');

const createSource = catchAsync(async (req, res) => {
  const result = await knowledgeService.createSource(req.body);
  sendResponse(res, 201, result, 'Knowledge source created successfully');
});

const listSources = catchAsync(async (req, res) => {
  const result = await knowledgeService.listSources();
  sendResponse(res, 200, result, 'Knowledge sources retrieved successfully');
});

const uploadDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.uploadAndCreateDocument({
    file: req.file,
    body: req.body,
    userId: req.user?.id,
  });
  sendResponse(res, 201, result, 'Medical knowledge document uploaded successfully');
});

const listDocuments = catchAsync(async (req, res) => {
  const result = await knowledgeService.listDocuments(req.query);
  sendResponse(res, 200, result, 'Medical knowledge documents retrieved');
});

const getDocumentById = catchAsync(async (req, res) => {
  const result = await knowledgeService.getDocumentById(req.params.id);
  sendResponse(res, 200, result, 'Medical knowledge document retrieved');
});

const extractDocumentText = catchAsync(async (req, res) => {
  const result = await knowledgeService.extractDocumentContent(
    req.params.id,
    req.body.override_content
  );
  sendResponse(res, 200, result, 'Document text extracted and normalized successfully');
});

const structureDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.structureDocument(req.params.id);
  sendResponse(res, 200, result, 'Document structured with AI and ready for review');
});

const validateDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.validateDocument(req.params.id);
  sendResponse(res, 200, result, 'Document medical claims and grounding validated');
});

const updateDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.updateDocument(req.params.id, req.body);
  sendResponse(res, 200, result, 'Document updated successfully');
});

const approveDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.reviewAndApproveDocument(req.params.id, {
    reviewerId: req.user?.id,
    notes: req.body.notes,
    editedTitle: req.body.edited_title,
    editedSummary: req.body.edited_summary,
  });
  sendResponse(res, 200, result, 'Document clinically approved for chunking and indexing');
});

const rejectDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.rejectDocument(req.params.id, {
    reviewerId: req.user?.id,
    reason: req.body.reason,
  });
  sendResponse(res, 200, result, 'Document rejected with clinical reason');
});

const archiveDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.archiveDocument(req.params.id, {
    reviewerId: req.user?.id,
    reason: req.body.reason,
  });
  sendResponse(res, 200, result, 'Document archived');
});

const generateChunks = catchAsync(async (req, res) => {
  const result = await knowledgeService.generateDocumentChunks(req.params.id, req.body);
  sendResponse(res, 201, result, 'Semantic chunks generated with full source traceability');
});

const indexDocument = catchAsync(async (req, res) => {
  const result = await knowledgeService.indexDocument(req.params.id);
  sendResponse(res, 200, result, 'Document and chunks embedded and indexed in vector store');
});

const searchVector = catchAsync(async (req, res) => {
  const result = await knowledgeService.searchSimilarChunks(req.body.query, {
    domain: req.body.domain,
    topic: req.body.topic,
    subtopic: req.body.subtopic,
    limit: req.body.limit,
    minScore: req.body.minScore,
  });
  sendResponse(res, 200, result, 'Vector similarity search executed');
});

const searchHybrid = catchAsync(async (req, res) => {
  const result = await knowledgeService.hybridSearch(req.body.query, {
    domain: req.body.domain,
    topic: req.body.topic,
    limit: req.body.limit,
    minScore: req.body.minScore,
  });
  sendResponse(res, 200, result, 'Hybrid knowledge search executed');
});

module.exports = {
  createSource,
  listSources,
  uploadDocument,
  listDocuments,
  getDocumentById,
  extractDocumentText,
  structureDocument,
  validateDocument,
  updateDocument,
  approveDocument,
  rejectDocument,
  archiveDocument,
  generateChunks,
  indexDocument,
  searchVector,
  searchHybrid,
};
