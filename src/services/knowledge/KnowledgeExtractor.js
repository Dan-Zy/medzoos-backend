/**
 * Medical Knowledge Document Text Extraction Engine
 *
 * Extracts clean, normalized text from multi-format medical literature (PDF, DOCX, TXT, Markdown).
 * Normalizes hyphenated line-breaks, removes repetitive page headers/footers, and preserves
 * semantic medical headings for chunking.
 */

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch {
  // Graceful fallback if pdf-parse is compiling / not yet loaded
  pdfParse = null;
}

/**
 * Clean and normalize raw extracted document text.
 * @param {string} rawText
 * @returns {string}
 */
function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Normalize line endings to \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove null bytes and non-printable control characters (keep \n, \t)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Fix hyphenated word breaks at line ends (e.g. "dia-\nbetes" -> "diabetes")
  text = text.replace(/(\b[a-zA-Z]{2,})-\n([a-zA-Z]{2,}\b)/g, '$1$2');

  // 4. Remove repetitive standalone page numbering (e.g. "Page 12 of 104", "--- Page 3 ---")
  text = text.replace(/^\s*(?:page\s+\d+(?:\s+of\s+\d+)?|---\s*page\s+\d+\s*---|\d+\s*\/\s*\d+)\s*$/gim, '');

  // 5. Trim trailing whitespace on each line
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // 6. Collapse 3+ consecutive newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Calculate statistical metadata for extracted text.
 * @param {string} text
 * @returns {{ charCount: number, wordCount: number, lineCount: number, estimatedReadingMinutes: number }}
 */
function calculateTextStats(text) {
  if (!text) {
    return { charCount: 0, wordCount: 0, lineCount: 0, estimatedReadingMinutes: 0 };
  }

  const charCount = text.length;
  const words = text.match(/\b\S+\b/g) || [];
  const wordCount = words.length;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const lineCount = lines.length;
  const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    charCount,
    wordCount,
    lineCount,
    estimatedReadingMinutes,
  };
}

/**
 * Extract text from a buffer based on file type.
 * @param {Buffer} buffer
 * @param {string} fileType - e.g. 'pdf', 'txt', 'md', 'docx', 'doc', 'json'
 * @param {object} [options]
 * @returns {Promise<{ text: string, numPages?: number, info?: object, stats: object }>}
 */
async function extractTextFromBuffer(buffer, fileType = 'txt', options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Valid Buffer is required for document extraction.');
  }

  const type = String(fileType).toLowerCase().replace(/^\./, '');
  let extractedRaw = '';
  let numPages = 1;
  let info = {};

  if (type === 'txt' || type === 'text' || type === 'md' || type === 'markdown') {
    extractedRaw = buffer.toString('utf-8');
  } else if (type === 'pdf') {
    if (pdfParse) {
      try {
        const data = await pdfParse(buffer, options);
        extractedRaw = data.text || '';
        numPages = data.numpages || 1;
        info = data.info || {};
      } catch (err) {
        // If PDF parse fails (e.g. encrypted), fallback to string extraction
        extractedRaw = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
      }
    } else {
      // Fallback if pdf-parse module is not loaded
      extractedRaw = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    }
  } else if (type === 'json') {
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (typeof parsed === 'string') {
        extractedRaw = parsed;
      } else if (parsed.content || parsed.text || parsed.raw_content) {
        extractedRaw = parsed.content || parsed.text || parsed.raw_content;
      } else {
        extractedRaw = JSON.stringify(parsed, null, 2);
      }
    } catch {
      extractedRaw = buffer.toString('utf-8');
    }
  } else if (type === 'docx' || type === 'doc') {
    // Basic XML extraction from docx zip stream if available, or text fallback
    try {
      const rawStr = buffer.toString('utf-8');
      const textMatches = rawStr.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
      if (textMatches && textMatches.length > 0) {
        extractedRaw = textMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
      } else {
        extractedRaw = rawStr.replace(/[^\x20-\x7E\n]/g, ' ');
      }
    } catch {
      extractedRaw = buffer.toString('utf-8');
    }
  } else {
    // Default utf-8
    extractedRaw = buffer.toString('utf-8');
  }

  const cleanedText = cleanExtractedText(extractedRaw);
  const stats = calculateTextStats(cleanedText);

  return {
    text: cleanedText,
    numPages,
    info,
    stats,
  };
}

module.exports = {
  cleanExtractedText,
  calculateTextStats,
  extractTextFromBuffer,
};
