/**
 * Semantic Chunking Engine with Full Source Traceability
 *
 * Rules:
 * 1. Semantic boundary preservation (respects sections, paragraphs, sentence boundaries).
 * 2. Target chunk size: 200–500 tokens (~800–2000 chars) with 10–15% sliding window overlap.
 * 3. Never splits in the middle of sentences or clinical numbers (e.g. "7.0%").
 * 4. Injects rich retrieval context headers into each chunk.
 * 5. Attaches full provenance metadata: document_id, source, version, domain, topic, section, chunk_index.
 */

/**
 * Approximate token count for text (average ~4 chars per token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/**
 * Split text into clean sentences without breaking on common medical abbreviations or decimals.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  if (!text) return [];

  // Protect decimals and abbreviations
  const protectedText = text
    .replace(/(\b[0-9]+)\.([0-9]+\b)/g, '$1__DECIMAL__$2')
    .replace(/\b(e\.g\.|i\.e\.|dr\.|mr\.|mrs\.|vs\.|approx\.|no\.|mg\/dl\.|mmol\/l\.)/gi, (m) =>
      m.replace(/\./g, '__DOT__')
    );

  const sentences = protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/m)
    .map((s) => s.replace(/__DECIMAL__/g, '.').replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Slice long section text into overlapping chunks along sentence boundaries.
 * @param {string} text - Section text
 * @param {number} [maxChars] - Maximum chunk character length (default 1400 chars ~ 350 tokens)
 * @param {number} [overlapChars] - Sliding overlap (default 200 chars ~ 50 tokens)
 * @returns {string[]}
 */
function chunkTextBySentenceWindow(text, maxChars = 1400, overlapChars = 200) {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return [text];

  const chunks = [];
  let currentChunkSentences = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    if (currentLen + sentence.length > maxChars && currentChunkSentences.length > 0) {
      chunks.push(currentChunkSentences.join(' '));

      // Calculate sliding window overlap from trailing sentences
      const overlapSentences = [];
      let overlapLen = 0;
      for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
        const s = currentChunkSentences[i];
        if (overlapLen + s.length <= overlapChars) {
          overlapSentences.unshift(s);
          overlapLen += s.length;
        } else {
          break;
        }
      }

      currentChunkSentences = [...overlapSentences, sentence];
      currentLen = currentChunkSentences.reduce((sum, s) => sum + s.length, 0);
    } else {
      currentChunkSentences.push(sentence);
      currentLen += sentence.length;
    }
  }

  if (currentChunkSentences.length > 0) {
    chunks.push(currentChunkSentences.join(' '));
  }

  return chunks;
}

/**
 * Generate semantic chunks from a HealthKnowledgeDocument with complete provenance.
 * @param {object} doc - HealthKnowledgeDocument instance
 * @param {object} [options] - Optional chunking parameters
 * @returns {Array<{ document_id: string, chunk_index: number, section: string, content: string, tokens_count: number, status: string, metadata: object }>}
 */
function generateSemanticChunks(doc, options = {}) {
  if (!doc) throw new Error('Document is required for semantic chunking.');

  const maxChars = options.maxChars || 1400;
  const overlapChars = options.overlapChars || 200;

  const chunks = [];
  let chunkIndex = 0;

  const baseMetadata = {
    source_id: doc.source_id || null,
    source_name: doc.source_name || doc.source_ref?.name || 'Unknown Source',
    source_type: doc.source_type || doc.source_ref?.type || 'guideline',
    source_version: doc.source_version || '1.0',
    source_url: doc.source_url || doc.source_ref?.url || null,
    domain: doc.domain,
    subdomain: doc.subdomain || null,
    topic: doc.topic,
    subtopic: doc.subtopic || null,
    language: doc.language || 'en',
    keywords: doc.keywords || [],
    document_title: doc.title,
  };

  const contextHeaderPrefix = `[Document: ${doc.title} | Domain: ${doc.domain} | Topic: ${doc.topic}]`;

  // 1. If document has structured sections, chunk per section
  const structured = doc.structured_content;
  if (structured && Array.isArray(structured.sections) && structured.sections.length > 0) {
    for (const sec of structured.sections) {
      const sectionHeading = sec.heading || 'General Section';
      const sectionContext = `${contextHeaderPrefix}\n[Section: ${sectionHeading}]\n`;

      const sectionBody = [
        sec.content || '',
        Array.isArray(sec.key_points) && sec.key_points.length > 0
          ? `Key Takeaways:\n- ${sec.key_points.join('\n- ')}`
          : '',
        Array.isArray(sec.clinical_pearls) && sec.clinical_pearls.length > 0
          ? `Clinical Pearls:\n- ${sec.clinical_pearls.join('\n- ')}`
          : '',
      ]
        .filter((part) => part.trim().length > 0)
        .join('\n\n');

      if (sectionBody.length <= maxChars) {
        const fullContent = `${sectionContext}${sectionBody}`.trim();
        chunks.push({
          document_id: doc.id,
          chunk_index: chunkIndex++,
          domain: doc.domain,
          subdomain: doc.subdomain || null,
          topic: doc.topic,
          subtopic: doc.subtopic || null,
          title: doc.title,
          section: sectionHeading,
          language: doc.language || 'en',
          source: baseMetadata.source_name,
          source_type: baseMetadata.source_type,
          source_version: baseMetadata.source_version,
          content: fullContent,
          tokens_count: estimateTokens(fullContent),
          status: doc.status || 'APPROVED',
          metadata: {
            ...baseMetadata,
            section: sectionHeading,
            key_points: sec.key_points || [],
          },
        });
      } else {
        const textSlices = chunkTextBySentenceWindow(sectionBody, maxChars, overlapChars);
        for (let i = 0; i < textSlices.length; i++) {
          const sliceHeader = `${sectionContext}[Part ${i + 1} of ${textSlices.length}]\n`;
          const fullContent = `${sliceHeader}${textSlices[i]}`.trim();
          chunks.push({
            document_id: doc.id,
            chunk_index: chunkIndex++,
            domain: doc.domain,
            subdomain: doc.subdomain || null,
            topic: doc.topic,
            subtopic: doc.subtopic || null,
            title: doc.title,
            section: `${sectionHeading} (Part ${i + 1})`,
            language: doc.language || 'en',
            source: baseMetadata.source_name,
            source_type: baseMetadata.source_type,
            source_version: baseMetadata.source_version,
            content: fullContent,
            tokens_count: estimateTokens(fullContent),
            status: doc.status || 'APPROVED',
            metadata: {
              ...baseMetadata,
              section: sectionHeading,
              part: i + 1,
              total_parts: textSlices.length,
            },
          });
        }
      }
    }
  } else {
    // 2. Fallback to raw_content chunking
    const raw = doc.raw_content || '';
    const rawBlocks = raw.split(/(?=^#{1,3}\s+)/m).filter((b) => b.trim().length > 0);

    if (rawBlocks.length > 1) {
      for (const block of rawBlocks) {
        const lines = block.trim().split('\n');
        const heading = lines[0].replace(/^#{1,3}\s+/, '').trim() || 'Overview';
        const body = lines.slice(1).join('\n').trim() || heading;
        const textSlices = chunkTextBySentenceWindow(body, maxChars, overlapChars);

        for (let i = 0; i < textSlices.length; i++) {
          const blockHeader = `${contextHeaderPrefix}\n[Section: ${heading}${textSlices.length > 1 ? ` Part ${i + 1}` : ''}]\n`;
          const fullContent = `${blockHeader}${textSlices[i]}`.trim();
          chunks.push({
            document_id: doc.id,
            chunk_index: chunkIndex++,
            domain: doc.domain,
            subdomain: doc.subdomain || null,
            topic: doc.topic,
            subtopic: doc.subtopic || null,
            title: doc.title,
            section: heading,
            language: doc.language || 'en',
            source: baseMetadata.source_name,
            source_type: baseMetadata.source_type,
            source_version: baseMetadata.source_version,
            content: fullContent,
            tokens_count: estimateTokens(fullContent),
            status: doc.status || 'APPROVED',
            metadata: {
              ...baseMetadata,
              section: heading,
            },
          });
        }
      }
    } else {
      const textSlices = chunkTextBySentenceWindow(raw, maxChars, overlapChars);
      for (let i = 0; i < textSlices.length; i++) {
        const blockHeader = `${contextHeaderPrefix}\n[Section: Overview${textSlices.length > 1 ? ` Part ${i + 1}` : ''}]\n`;
        const fullContent = `${blockHeader}${textSlices[i]}`.trim();
        chunks.push({
          document_id: doc.id,
          chunk_index: chunkIndex++,
          domain: doc.domain,
          subdomain: doc.subdomain || null,
          topic: doc.topic,
          subtopic: doc.subtopic || null,
          title: doc.title,
          section: 'Overview',
          language: doc.language || 'en',
          source: baseMetadata.source_name,
          source_type: baseMetadata.source_type,
          source_version: baseMetadata.source_version,
          content: fullContent,
          tokens_count: estimateTokens(fullContent),
          status: doc.status || 'APPROVED',
          metadata: {
            ...baseMetadata,
            section: 'Overview',
          },
        });
      }
    }
  }

  return chunks;
}

module.exports = {
  generateSemanticChunks,
  chunkTextBySentenceWindow,
  splitIntoSentences,
  estimateTokens,
};
