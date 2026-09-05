/**
 * Medical Knowledge Ingestion & Management Service
 *
 * Handles document uploads, knowledge sources, taxonomy validation,
 * and lifecycle transitions for production medical RAG.
 */

const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const storageService = require('../../storage/storage.service');
const { validateTaxonomyPayload } = require('../../services/taxonomy');
const { KNOWLEDGE_STATUS } = require('./knowledge.constants');

/**
 * Register a trusted medical knowledge source (e.g. ADA, WHO, NICE).
 */
async function createSource(data) {
  const existing = await prisma.knowledgeSource.findUnique({
    where: { slug: data.slug.toLowerCase().trim() },
  });
  if (existing) {
    throw new AppError(`Knowledge source with slug "${data.slug}" already exists`, 409);
  }

  return prisma.knowledgeSource.create({
    data: {
      name: data.name.trim(),
      slug: data.slug.toLowerCase().trim(),
      type: data.type,
      publisher: data.publisher || null,
      url: data.url || null,
      license: data.license || null,
      is_verified: data.is_verified ?? true,
      description: data.description || null,
    },
  });
}

/**
 * List registered knowledge sources.
 */
async function listSources() {
  return prisma.knowledgeSource.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { documents: true } },
    },
  });
}

/**
 * Upload a medical source document and create a HealthKnowledgeDocument in DRAFT status.
 */
async function uploadAndCreateDocument({ file, body, userId }) {
  // 1. Validate taxonomy against centralized controlled taxonomy
  const taxCheck = validateTaxonomyPayload({
    domain: body.domain,
    subdomain: body.subdomain,
    topic: body.topic,
    subtopic: body.subtopic,
  });

  if (!taxCheck.valid) {
    throw new AppError(`Taxonomy validation failed: ${taxCheck.errors.join('; ')}`, 400);
  }

  const { domain, subdomain, topic, subtopic } = taxCheck.normalized;

  let fileUrl = null;
  let fileName = null;
  let fileType = null;

  // 2. Upload file to cloud/object storage if provided
  if (file) {
    fileName = file.originalname;
    const ext = fileName.split('.').pop()?.toLowerCase();
    fileType = ext || 'bin';

    fileUrl = await storageService.uploadFile(
      file.buffer,
      fileName,
      'medical-knowledge',
      file.mimetype || 'application/octet-stream'
    );
  }

  // 3. Raw content: use provided text, or if file is text/md read it, otherwise placeholder
  let rawContent = body.raw_content ? String(body.raw_content).trim() : '';
  if (!rawContent && file) {
    if (fileType === 'txt' || fileType === 'md') {
      rawContent = file.buffer.toString('utf-8');
    } else {
      rawContent = `[Pending Extraction from ${fileName}]`;
    }
  }

  if (!rawContent && !file) {
    throw new AppError('Either a document file or raw_content text must be provided.', 400);
  }

  // 4. Create document in database
  const doc = await prisma.healthKnowledgeDocument.create({
    data: {
      title: body.title.trim(),
      domain,
      subdomain: subdomain || null,
      topic,
      subtopic: subtopic || null,
      source_id: body.source_id || null,
      source_name: body.source_name ? body.source_name.trim() : null,
      source_type: body.source_type || 'guideline',
      source_url: body.source_url || null,
      source_version: body.source_version || '1.0',
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      language: body.language || 'en',
      summary: body.summary ? body.summary.trim() : null,
      raw_content: rawContent,
      status: KNOWLEDGE_STATUS.DRAFT,
      metadata: {
        uploaded_by: userId,
        initial_file_size: file ? file.size : null,
        mimetype: file ? file.mimetype : null,
      },
    },
    include: {
      source_ref: true,
    },
  });

  return doc;
}

/**
 * List documents with filtering, search, and pagination.
 */
async function listDocuments(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const where = {};

  if (query.domain) where.domain = query.domain;
  if (query.topic) where.topic = query.topic;
  if (query.status) where.status = query.status;
  if (query.source_id) where.source_id = query.source_id;

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { summary: { contains: query.search, mode: 'insensitive' } },
      { source_name: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, documents] = await Promise.all([
    prisma.healthKnowledgeDocument.count({ where }),
    prisma.healthKnowledgeDocument.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        source_ref: { select: { id: true, name: true, type: true } },
        _count: { select: { chunks: true } },
      },
    }),
  ]);

  return {
    documents,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retrieve document by ID with chunks and source provenance.
 */
async function getDocumentById(id) {
  const doc = await prisma.healthKnowledgeDocument.findUnique({
    where: { id },
    include: {
      source_ref: true,
      chunks: {
        orderBy: { chunk_index: 'asc' },
        select: {
          id: true,
          chunk_index: true,
          section: true,
          content: true,
          tokens_count: true,
          status: true,
          created_at: true,
        },
      },
    },
  });

  if (!doc) {
    throw new AppError('Medical knowledge document not found', 404);
  }

  return doc;
}

/**
 * Extract and normalize raw text content for a document, updating status to PROCESSING.
 * @param {string} id - Document ID
 * @param {string} [overrideContent] - Optional direct content string
 */
async function extractDocumentContent(id, overrideContent = null) {
  const doc = await getDocumentById(id);

  const rawToProcess = overrideContent || doc.raw_content;
  if (!rawToProcess || rawToProcess.startsWith('[Pending Extraction')) {
    throw new AppError('No extractable text content available for this document.', 400);
  }

  const { cleanExtractedText, calculateTextStats } = require('../../services/knowledge/KnowledgeExtractor');
  const cleaned = cleanExtractedText(rawToProcess);
  const stats = calculateTextStats(cleaned);

  const updated = await prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      raw_content: cleaned,
      status: KNOWLEDGE_STATUS.PROCESSING,
      metadata: {
        ...(doc.metadata || {}),
        stats,
        extracted_at: new Date().toISOString(),
      },
    },
    include: {
      source_ref: true,
      chunks: true,
    },
  });

  return updated;
}

/**
 * AI-assisted structuring of document content into semantic sections, key points, and keywords.
 * Transitions status to REVIEW_REQUIRED.
 * @param {string} id - Document ID
 */
async function structureDocument(id) {
  const doc = await getDocumentById(id);

  if (!doc.raw_content || doc.raw_content.startsWith('[Pending Extraction')) {
    throw new AppError('Document must have extracted raw_content before structuring.', 400);
  }

  const { structureDocumentText } = require('../../services/knowledge/KnowledgeStructurer');
  const result = await structureDocumentText(doc.raw_content, {
    domain: doc.domain,
    topic: doc.topic,
    subtopic: doc.subtopic,
    title: doc.title,
  });

  const structured = result.structured;

  const updated = await prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      structured_content: structured,
      summary: structured.summary || doc.summary,
      keywords: structured.keywords || [],
      domain: structured.domain || doc.domain,
      topic: structured.topic || doc.topic,
      subtopic: structured.subtopic || doc.subtopic,
      status: KNOWLEDGE_STATUS.REVIEW_REQUIRED,
      metadata: {
        ...(doc.metadata || {}),
        structuring_source: result.source,
        structuring_confidence: structured.confidence || 0.9,
        structured_at: new Date().toISOString(),
      },
    },
    include: {
      source_ref: true,
      chunks: true,
    },
  });

  return updated;
}

/**
 * Validate document for clinical safety, grounding, numerical thresholds, and taxonomy compliance.
 * @param {string} id - Document ID
 */
async function validateDocument(id) {
  const doc = await getDocumentById(id);

  const { validateDocumentClaims } = require('../../services/knowledge/MedicalClaimValidator');
  const report = validateDocumentClaims(doc);

  const updated = await prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      metadata: {
        ...(doc.metadata || {}),
        validation_report: report,
        validated_at: new Date().toISOString(),
      },
    },
    include: {
      source_ref: true,
      chunks: true,
    },
  });

  return {
    document: updated,
    validationReport: report,
  };
}

/**
 * Update document fields (title, summary, structured content, taxonomy).
 * @param {string} id
 * @param {object} data
 */
async function updateDocument(id, data) {
  const doc = await getDocumentById(id);

  if (data.domain || data.topic) {
    const taxCheck = validateTaxonomyPayload({
      domain: data.domain || doc.domain,
      subdomain: data.subdomain || doc.subdomain,
      topic: data.topic || doc.topic,
      subtopic: data.subtopic || doc.subtopic,
    });
    if (!taxCheck.valid) {
      throw new AppError(`Taxonomy validation failed: ${taxCheck.errors.join('; ')}`, 400);
    }
  }

  const updatePayload = {};
  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.summary !== undefined) updatePayload.summary = data.summary ? data.summary.trim() : null;
  if (data.domain !== undefined) updatePayload.domain = data.domain;
  if (data.topic !== undefined) updatePayload.topic = data.topic;
  if (data.subdomain !== undefined) updatePayload.subdomain = data.subdomain;
  if (data.subtopic !== undefined) updatePayload.subtopic = data.subtopic;
  if (data.keywords !== undefined) updatePayload.keywords = data.keywords;
  if (data.structured_content !== undefined) updatePayload.structured_content = data.structured_content;
  if (data.raw_content !== undefined) updatePayload.raw_content = data.raw_content;
  if (data.status !== undefined) updatePayload.status = data.status;

  return prisma.healthKnowledgeDocument.update({
    where: { id },
    data: updatePayload,
    include: {
      source_ref: true,
      chunks: true,
    },
  });
}

/**
 * Human/Clinical review and approval: transitions status to APPROVED with reviewer metadata.
 * @param {string} id
 * @param {object} options - { reviewerId, notes, editedTitle, editedSummary }
 */
async function reviewAndApproveDocument(id, { reviewerId, notes, editedTitle, editedSummary } = {}) {
  const doc = await getDocumentById(id);

  if (doc.status === KNOWLEDGE_STATUS.APPROVED || doc.status === KNOWLEDGE_STATUS.INDEXED) {
    return doc; // Already approved/indexed
  }

  const updateData = {
    status: KNOWLEDGE_STATUS.APPROVED,
    metadata: {
      ...(doc.metadata || {}),
      reviewed_by: reviewerId || 'system_admin',
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    },
  };

  if (editedTitle) updateData.title = editedTitle.trim();
  if (editedSummary) updateData.summary = editedSummary.trim();

  return prisma.healthKnowledgeDocument.update({
    where: { id },
    data: updateData,
    include: {
      source_ref: true,
      chunks: true,
    },
  });
}

/**
 * Rejection of medical document: transitions status to REJECTED with mandatory reason.
 * @param {string} id
 * @param {object} options - { reviewerId, reason }
 */
async function rejectDocument(id, { reviewerId, reason }) {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new AppError('A valid rejection reason (min 5 chars) is mandatory for clinical audit.', 400);
  }

  const doc = await getDocumentById(id);

  return prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      status: KNOWLEDGE_STATUS.REJECTED,
      metadata: {
        ...(doc.metadata || {}),
        rejected_by: reviewerId || 'system_admin',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
      },
    },
    include: {
      source_ref: true,
    },
  });
}

/**
 * Archiving of deprecated/superseded medical document.
 * @param {string} id
 * @param {object} options - { reviewerId, reason }
 */
async function archiveDocument(id, { reviewerId, reason } = {}) {
  const doc = await getDocumentById(id);

  return prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      status: KNOWLEDGE_STATUS.ARCHIVED,
      metadata: {
        ...(doc.metadata || {}),
        archived_by: reviewerId || 'system_admin',
        archived_at: new Date().toISOString(),
        archive_reason: reason || null,
      },
    },
    include: {
      source_ref: true,
    },
  });
}

/**
 * Generate semantic chunks with full provenance and persist to health_knowledge_chunks.
 * @param {string} id - Document ID
 * @param {object} [options] - Optional chunking parameters
 */
async function generateDocumentChunks(id, options = {}) {
  const doc = await getDocumentById(id);

  if (!doc.raw_content && !doc.structured_content) {
    throw new AppError('Document has no extracted or structured content to chunk.', 400);
  }

  const { generateSemanticChunks } = require('../../services/knowledge/SemanticChunker');
  const chunksToCreate = generateSemanticChunks(doc, options);

  if (chunksToCreate.length === 0) {
    throw new AppError('No semantic chunks could be generated from document content.', 400);
  }

  // Idempotently purge existing chunks for this document before inserting
  await prisma.healthKnowledgeChunk.deleteMany({
    where: { document_id: id },
  });

  // Bulk create chunks
  await prisma.healthKnowledgeChunk.createMany({
    data: chunksToCreate.map((c) => ({
      document_id: c.document_id,
      chunk_index: c.chunk_index,
      domain: c.domain || doc.domain,
      subdomain: c.subdomain || doc.subdomain || null,
      topic: c.topic || doc.topic,
      subtopic: c.subtopic || doc.subtopic || null,
      title: c.title || doc.title,
      section: c.section,
      language: c.language || doc.language || 'en',
      source: c.source || doc.source_name || 'Medical Guideline',
      source_type: c.source_type || doc.source_type || 'guideline',
      source_version: c.source_version || doc.source_version || '1.0',
      content: c.content,
      tokens_count: c.tokens_count,
      status: doc.status || KNOWLEDGE_STATUS.APPROVED,
      metadata: c.metadata,
    })),
  });

  // Update document metadata
  await prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      metadata: {
        ...(doc.metadata || {}),
        chunk_count: chunksToCreate.length,
        chunks_generated_at: new Date().toISOString(),
      },
    },
  });

  return prisma.healthKnowledgeChunk.findMany({
    where: { document_id: id },
    orderBy: { chunk_index: 'asc' },
  });
}

/**
 * Generate vector embeddings for all chunks of a document and transition status to INDEXED.
 * @param {string} id - Document ID
 */
async function indexDocument(id) {
  const doc = await getDocumentById(id);

  const chunks = await prisma.healthKnowledgeChunk.findMany({
    where: { document_id: id },
    orderBy: { chunk_index: 'asc' },
  });

  if (chunks.length === 0) {
    throw new AppError('Document has no chunks. Generate chunks before indexing.', 400);
  }

  const { generateBatchEmbeddings, EMBEDDING_MODEL } = require('../../services/knowledge/VectorStoreProvider');
  const texts = chunks.map((c) => c.content);
  const embeddings = await generateBatchEmbeddings(texts);

  // Update each chunk with its embedding and INDEXED status
  await Promise.all(
    chunks.map((chunk, idx) =>
      prisma.healthKnowledgeChunk.update({
        where: { id: chunk.id },
        data: {
          embedding: embeddings[idx] || null,
          embedding_model: EMBEDDING_MODEL,
          status: KNOWLEDGE_STATUS.INDEXED,
        },
      })
    )
  );

  // Update document status to INDEXED
  const updatedDoc = await prisma.healthKnowledgeDocument.update({
    where: { id },
    data: {
      status: KNOWLEDGE_STATUS.INDEXED,
      metadata: {
        ...(doc.metadata || {}),
        indexed_at: new Date().toISOString(),
        embedding_model: EMBEDDING_MODEL,
        indexed_chunk_count: chunks.length,
      },
    },
    include: {
      source_ref: true,
      chunks: true,
    },
  });

  return updatedDoc;
}

/**
 * Search semantic vector store for matching clinical knowledge chunks.
 * @param {string} queryText
 * @param {object} options
 */
async function searchSimilarChunks(queryText, options = {}) {
  const { findSimilarChunks } = require('../../services/knowledge/VectorStoreProvider');
  return findSimilarChunks(queryText, options);
}

/**
 * Perform hybrid retrieval (Keyword + Vector + RRF + Clinical Re-ranking).
 * @param {string} queryText
 * @param {object} options
 */
async function hybridSearch(queryText, options = {}) {
  const { hybridRetrieve } = require('../../services/knowledge/HybridRetrievalEngine');
  return hybridRetrieve(queryText, options);
}

module.exports = {
  createSource,
  listSources,
  uploadAndCreateDocument,
  listDocuments,
  getDocumentById,
  extractDocumentContent,
  structureDocument,
  validateDocument,
  updateDocument,
  reviewAndApproveDocument,
  rejectDocument,
  archiveDocument,
  generateDocumentChunks,
  indexDocument,
  searchSimilarChunks,
  hybridSearch,
};

