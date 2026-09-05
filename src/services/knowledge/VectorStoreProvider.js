/**
 * Vector Store & Embedding Provider
 *
 * Handles:
 * 1. OpenAI text-embedding-3-small (1536 dimensions) embedding generation.
 * 2. Deterministic high-dimensional hash fallback when offline.
 * 3. High-performance vector cosine similarity calculations.
 * 4. Filtered semantic vector search enforcing RAG status whitelist ('APPROVED', 'INDEXED').
 */

const OpenAI = require('openai');
const env = require('../../config/env');
const prisma = require('../../config/database');
const { RAG_STATUS_WHITELIST } = require('../../modules/knowledge/knowledge.constants');
const { logger } = require('../../utils/logger');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const VECTOR_DIMENSIONS = 1536;

let client = null;
function getClient() {
  if (!env.OPENAI_API_KEY?.trim()) return null;
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

// In-memory LRU cache for query embeddings to accelerate repeated queries
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 1000;

function getCachedEmbedding(text) {
  return embeddingCache.get(text) || null;
}

function setCachedEmbedding(text, vector) {
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(text, vector);
}

/**
 * Deterministic dense vector generator for offline / fallback environments.
 * Creates a normalized 1536-dim vector from text tokens.
 * @param {string} text
 * @returns {number[]}
 */
function generateDeterministicVector(text) {
  const vec = new Array(VECTOR_DIMENSIONS).fill(0);
  const clean = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    vec[0] = 1.0;
    return vec;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % VECTOR_DIMENSIONS;
    vec[idx] += 1.0 + (i % 5) * 0.1;
  }

  // Normalize to unit length
  let norm = 0;
  for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
      vec[i] = parseFloat((vec[i] / norm).toFixed(6));
    }
  }

  return vec;
}

/**
 * Generate embedding vector for a single text.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return generateDeterministicVector('');
  }

  const cached = getCachedEmbedding(text);
  if (cached) return cached;

  const openai = getClient();
  if (!openai) {
    const vec = generateDeterministicVector(text);
    setCachedEmbedding(text, vec);
    return vec;
  }

  try {
    const sanitized = text.replace(/\n+/g, ' ').slice(0, 8000);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: sanitized,
    });

    const vector = response.data?.[0]?.embedding;
    if (vector && Array.isArray(vector)) {
      setCachedEmbedding(text, vector);
      return vector;
    }
    return generateDeterministicVector(text);
  } catch (err) {
    logger.warn('Embedding API call failed, using deterministic fallback', {
      error: err.message,
    });
    const vec = generateDeterministicVector(text);
    setCachedEmbedding(text, vec);
    return vec;
  }
}

/**
 * Generate embedding vectors for an array of texts in batch.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function generateBatchEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const openai = getClient();
  if (!openai) {
    return texts.map((t) => generateDeterministicVector(t));
  }

  try {
    const sanitizedList = texts.map((t) => (t || '').replace(/\n+/g, ' ').slice(0, 8000));
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: sanitizedList,
    });

    return response.data.map((d) => d.embedding);
  } catch (err) {
    logger.warn('Batch embedding API call failed, using deterministic fallback', {
      error: err.message,
    });
    return texts.map((t) => generateDeterministicVector(t));
  }
}

/**
 * Calculate Cosine Similarity between two numerical vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Value in range -1.0 to 1.0 (typically 0.0 to 1.0 for embeddings)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return parseFloat(similarity.toFixed(4));
}

/**
 * Perform semantic vector search across approved medical knowledge chunks.
 * Enforces production status whitelist ('APPROVED', 'INDEXED').
 *
 * @param {string} queryText - Patient query or clinical question
 * @param {object} [options]
 * @param {string} [options.domain] - Filter by domain
 * @param {string} [options.topic] - Filter by topic
 * @param {string} [options.subtopic] - Filter by subtopic
 * @param {number} [options.limit=5] - Top K results
 * @param {number} [options.minScore=0.55] - Minimum cosine similarity threshold
 * @returns {Promise<Array<{ chunk: object, score: number }>>}
 */
async function findSimilarChunks(queryText, options = {}) {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return [];
  }

  const queryVector = await generateEmbedding(queryText);
  const limit = options.limit || 5;
  const minScore = options.minScore || 0.55;

  const where = {
    status: { in: RAG_STATUS_WHITELIST },
    embedding: { not: null },
  };

  if (options.domain) where.domain = options.domain;
  if (options.topic) where.topic = options.topic;
  if (options.subtopic) where.subtopic = options.subtopic;

  // Retrieve candidate chunks with precomputed embeddings
  const candidateChunks = await prisma.healthKnowledgeChunk.findMany({
    where,
    take: 100, // Top 100 candidate pool for in-memory re-ranking
    include: {
      document: {
        select: {
          id: true,
          title: true,
          source_name: true,
          source_version: true,
          status: true,
        },
      },
    },
  });

  const scoredResults = [];

  for (const chunk of candidateChunks) {
    let chunkEmbedding = chunk.embedding;
    if (typeof chunkEmbedding === 'string') {
      try {
        chunkEmbedding = JSON.parse(chunkEmbedding);
      } catch {
        continue;
      }
    }

    if (Array.isArray(chunkEmbedding)) {
      const score = cosineSimilarity(queryVector, chunkEmbedding);
      if (score >= minScore) {
        scoredResults.push({
          chunk,
          score,
        });
      }
    }
  }

  // Sort descending by cosine similarity score
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, limit);
}

module.exports = {
  EMBEDDING_MODEL,
  VECTOR_DIMENSIONS,
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
  generateDeterministicVector,
  findSimilarChunks,
};
