/**
 * Hybrid Medical Retrieval Engine (Keyword + Vector + Re-ranking)
 *
 * Combines:
 * 1. Multilingual lexical search with Roman Urdu synonym expansion.
 * 2. Dense semantic vector search (cosine similarity).
 * 3. Reciprocal Rank Fusion (RRF with k=60).
 * 4. Clinical contextual re-ranking (source authority, topic match, freshness).
 * 5. Strict RAG whitelist enforcement (status IN ['APPROVED', 'INDEXED']).
 */

const prisma = require('../../config/database');
const { RAG_STATUS_WHITELIST } = require('../../modules/knowledge/knowledge.constants');
const { resolveTaxonomyFromText, DOMAIN_REGISTRY } = require('../taxonomy');
const { findSimilarChunks } = require('./VectorStoreProvider');
const { retrievalCache } = require('../copilot/cache/CopilotCacheEngine');

const RRF_K = 60;

/**
 * Extract search keywords and multilingual synonyms for a user query.
 * @param {string} queryText
 * @param {object} taxonomyMatch
 * @returns {string[]}
 */
function expandQueryTerms(queryText, taxonomyMatch) {
  const terms = new Set();
  const rawClean = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  // Add individual significant words (> 2 chars)
  rawClean.split(/\s+/).forEach((w) => {
    if (w.length > 2 && !['the', 'and', 'for', 'are', 'what', 'how', 'kya', 'hai', 'mein', 'hota', 'hoti', 'meri', 'mera'].includes(w)) {
      terms.add(w);
    }
  });

  // Add taxonomy matched synonyms
  if (taxonomyMatch && taxonomyMatch.domain && taxonomyMatch.topic) {
    terms.add(taxonomyMatch.topic.replace(/_/g, ' '));
    const domainDef = DOMAIN_REGISTRY[taxonomyMatch.domain];
    const topicDef = domainDef?.TOPICS?.[taxonomyMatch.topic];
    if (topicDef?.synonyms) {
      topicDef.synonyms.slice(0, 5).forEach((syn) => terms.add(syn.toLowerCase()));
    }
  }

  return Array.from(terms);
}

/**
 * Execute Lexical / BM25-style keyword search in PostgreSQL.
 * @param {string[]} terms
 * @param {object} options
 * @returns {Promise<Array<{ chunk: object, lexicalScore: number }>>}
 */
async function searchLexicalChunks(terms, options = {}) {
  if (!terms || terms.length === 0) return [];

  const where = {
    status: { in: RAG_STATUS_WHITELIST },
  };

  if (options.domain) where.domain = options.domain;
  if (options.topic) where.topic = options.topic;

  // Build OR conditions for terms matching content, section, topic, or title
  const termConditions = terms.map((term) => ({
    OR: [
      { content: { contains: term, mode: 'insensitive' } },
      { section: { contains: term, mode: 'insensitive' } },
      { topic: { contains: term, mode: 'insensitive' } },
      { title: { contains: term, mode: 'insensitive' } },
    ],
  }));

  where.AND = [{ OR: termConditions.flatMap((t) => t.OR) }];

  const candidateChunks = await prisma.healthKnowledgeChunk.findMany({
    where,
    take: 50,
    include: {
      document: {
        select: {
          id: true,
          title: true,
          source_name: true,
          source_version: true,
          source_type: true,
          status: true,
        },
      },
    },
  });

  // Score candidates based on term frequency and field hits
  const scored = candidateChunks.map((chunk) => {
    let score = 0;
    const contentLower = chunk.content.toLowerCase();
    const sectionLower = (chunk.section || '').toLowerCase();
    const topicLower = chunk.topic.toLowerCase();

    for (const term of terms) {
      if (contentLower.includes(term)) score += 1.0;
      if (sectionLower.includes(term)) score += 1.5;
      if (topicLower.includes(term)) score += 2.0;
    }

    return {
      chunk,
      lexicalScore: score,
    };
  });

  scored.sort((a, b) => b.lexicalScore - a.lexicalScore);
  return scored;
}

/**
 * Perform Hybrid Retrieval (Vector + Keyword + RRF + Clinical Re-ranking).
 *
 * @param {string} queryText - Natural language patient question (English, Urdu, Roman Urdu)
 * @param {object} [options]
 * @param {string} [options.domain] - Explicit domain override
 * @param {string} [options.topic] - Explicit topic override
 * @param {number} [options.limit=5] - Number of top chunks to return
 * @param {number} [options.minScore=0.45] - Minimum combined score
 * @returns {Promise<{ results: object[], queryTaxonomy: object, totalCandidates: number }>}
 */
async function hybridRetrieve(queryText, options = {}) {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { results: [], queryTaxonomy: null, totalCandidates: 0 };
  }

  const cacheKey = `hybrid:${queryText.trim().toLowerCase()}:${options.limit || 5}:${options.domain || ''}:${options.topic || ''}`;
  const cached = retrievalCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 1. Query Analysis & Multilingual Taxonomy Resolution
  const resolvedTaxonomy = resolveTaxonomyFromText(queryText);
  const targetDomain = options.domain || resolvedTaxonomy.domain || null;
  const targetTopic = options.topic || resolvedTaxonomy.topic || null;

  const searchOptions = {
    domain: targetDomain,
    topic: options.topic || null,
    limit: 20,
  };

  // 2. Parallel Lexical & Vector Retrieval
  const terms = expandQueryTerms(queryText, resolvedTaxonomy);

  let [vectorResults, lexicalResults] = await Promise.all([
    findSimilarChunks(queryText, { ...searchOptions, minScore: 0.20 }),
    searchLexicalChunks(terms, searchOptions),
  ]);

  // If domain filter was too restrictive and returned 0 results, search across all approved knowledge
  if (vectorResults.length === 0 && lexicalResults.length === 0 && targetDomain) {
    const fallbackOptions = { limit: 20 };
    [vectorResults, lexicalResults] = await Promise.all([
      findSimilarChunks(queryText, { ...fallbackOptions, minScore: 0.20 }),
      searchLexicalChunks(terms, fallbackOptions),
    ]);
  }

  // 3. Reciprocal Rank Fusion (RRF)
  const chunkMap = new Map();

  // Add Vector ranks
  vectorResults.forEach((item, index) => {
    const chunkId = item.chunk.id;
    const vectorRank = index + 1;
    const rrfScore = 1 / (RRF_K + vectorRank);

    chunkMap.set(chunkId, {
      chunk: item.chunk,
      vectorScore: item.score,
      vectorRank,
      lexicalScore: 0,
      lexicalRank: 999,
      rrfScore,
      retrievalMethods: ['vector'],
    });
  });

  // Add Lexical ranks
  lexicalResults.forEach((item, index) => {
    const chunkId = item.chunk.id;
    const lexicalRank = index + 1;
    const lexicalRRF = 1 / (RRF_K + lexicalRank);

    if (chunkMap.has(chunkId)) {
      const existing = chunkMap.get(chunkId);
      existing.lexicalScore = item.lexicalScore;
      existing.lexicalRank = lexicalRank;
      existing.rrfScore += lexicalRRF;
      existing.retrievalMethods.push('keyword');
    } else {
      chunkMap.set(chunkId, {
        chunk: item.chunk,
        vectorScore: 0,
        vectorRank: 999,
        lexicalScore: item.lexicalScore,
        lexicalRank,
        rrfScore: lexicalRRF,
        retrievalMethods: ['keyword'],
      });
    }
  });

  const fusedCandidates = Array.from(chunkMap.values());

  // 4. Clinical Re-ranking & Authority Boosting
  for (const candidate of fusedCandidates) {
    let boost = 1.0;
    const chunk = candidate.chunk;

    // A. Exact Topic Match Boost
    if (targetTopic && chunk.topic === targetTopic) {
      boost += 0.25;
    }

    // B. High Authority Source Boost (ADA, WHO, NICE, MoH)
    const src = (chunk.source || '').toLowerCase();
    if (src.includes('ada') || src.includes('who') || src.includes('nice') || src.includes('standards of care')) {
      boost += 0.15;
    }

    // C. Dual-hit bonus (matched BOTH vector AND lexical)
    if (candidate.retrievalMethods.length > 1) {
      boost += 0.20;
    }

    // Final combined score (normalized to ~0.0 to 1.0)
    const baseScore = candidate.rrfScore * 35; // Scale RRF into standard range
    const combined = Math.min(1.0, (baseScore + candidate.vectorScore * 0.4) * boost);
    candidate.finalScore = parseFloat(combined.toFixed(4));
  }

  // Sort descending by finalScore
  fusedCandidates.sort((a, b) => b.finalScore - a.finalScore);

  // 5. Diversity & Deduplication (max 2 chunks per parent document)
  const limit = options.limit || 5;
  const minScore = options.minScore || 0.35;
  const documentHitCount = {};
  const finalResults = [];

  for (const candidate of fusedCandidates) {
    if (candidate.finalScore < minScore) continue;

    const docId = candidate.chunk.document_id;
    const currentHits = documentHitCount[docId] || 0;

    if (currentHits < 2 || finalResults.length < 2) {
      documentHitCount[docId] = currentHits + 1;
      finalResults.push({
        chunk_id: candidate.chunk.id,
        document_id: candidate.chunk.document_id,
        document_title: candidate.chunk.document?.title || candidate.chunk.title,
        source_name: candidate.chunk.source,
        source_version: candidate.chunk.source_version,
        domain: candidate.chunk.domain,
        topic: candidate.chunk.topic,
        subtopic: candidate.chunk.subtopic,
        section: candidate.chunk.section,
        content: candidate.chunk.content,
        score: candidate.finalScore,
        retrieval_method: candidate.retrievalMethods.join(' + '),
        tokens_count: candidate.chunk.tokens_count,
      });
    }

    if (finalResults.length >= limit) break;
  }

  const payload = {
    results: finalResults,
    queryTaxonomy: resolvedTaxonomy,
    totalCandidates: fusedCandidates.length,
  };
  retrievalCache.set(cacheKey, payload);
  return payload;
}

module.exports = {
  hybridRetrieve,
  searchLexicalChunks,
  expandQueryTerms,
  RRF_K,
};
