/**
 * Medical Knowledge Ingestion & Admin Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const AppError = require('../../utils/AppError');
const knowledgeController = require('./knowledge.controller');
const knowledgeValidator = require('./knowledge.validator');

// Memory storage for cloud upload
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.originalname.match(/\.(pdf|txt|md|doc|docx)$/i)
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Unsupported file format. Please upload PDF, TXT, Markdown, or Word documents.',
        400
      ),
      false
    );
  }
};

const documentUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter,
});

// All knowledge management routes are restricted to administrators
router.use(protect, restrictTo('admin'));

// Knowledge Sources
router.post(
  '/sources',
  validate(knowledgeValidator.createSourceSchema),
  knowledgeController.createSource
);
router.get('/sources', knowledgeController.listSources);

// Document Upload & Ingestion
router.post(
  '/documents/upload',
  documentUpload.single('file'),
  validate(knowledgeValidator.uploadDocumentSchema),
  knowledgeController.uploadDocument
);
router.get(
  '/documents',
  validate(knowledgeValidator.queryDocumentsSchema, 'query'),
  knowledgeController.listDocuments
);
router.get('/documents/:id', knowledgeController.getDocumentById);
router.put(
  '/documents/:id',
  validate(knowledgeValidator.updateDocumentSchema),
  knowledgeController.updateDocument
);
router.post('/documents/:id/extract', knowledgeController.extractDocumentText);
router.post('/documents/:id/structure', knowledgeController.structureDocument);
router.post('/documents/:id/validate', knowledgeController.validateDocument);
router.post(
  '/documents/:id/approve',
  validate(knowledgeValidator.approveDocumentSchema),
  knowledgeController.approveDocument
);
router.post(
  '/documents/:id/reject',
  validate(knowledgeValidator.rejectDocumentSchema),
  knowledgeController.rejectDocument
);
router.post(
  '/documents/:id/archive',
  validate(knowledgeValidator.archiveDocumentSchema),
  knowledgeController.archiveDocument
);
router.post('/documents/:id/chunk', knowledgeController.generateChunks);
router.post('/documents/:id/index', knowledgeController.indexDocument);
router.post('/chunks/search-vector', knowledgeController.searchVector);
router.post('/chunks/search-hybrid', knowledgeController.searchHybrid);

module.exports = router;
