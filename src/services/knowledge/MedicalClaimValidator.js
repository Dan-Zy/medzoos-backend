/**
 * Medical Claim & Grounding Validation Engine
 *
 * Enforces healthcare safety standards on structured medical literature:
 * 1. Prohibits dangerous medical claims (unverified cures, stopping medications without supervision, dangerous home remedies).
 * 2. Validates numerical clinical boundaries (HbA1c %, glucose mg/dL).
 * 3. Verifies grounding against raw source text (prevents hallucinated facts).
 * 4. Ensures taxonomy compliance.
 */

const { validateTaxonomyPayload } = require('../taxonomy');

// Blacklist of dangerous, unverified, or harmful claims
const DANGEROUS_CLAIM_PATTERNS = [
  { pattern: /\b(cure|curing|cured)\s+(diabetes|sugar|schizophrenia|bipolar)\b/i, reason: 'Claims of permanent cure for chronic conditions without clinical qualification' },
  { pattern: /\b(stop|discontinue|quit)\s+(taking\s+)?(insulin|metformin|antidepressants|psychiatric medications?)\s+(immediately|completely|without doctor)\b/i, reason: 'Dangerous recommendation to stop essential prescription medications' },
  { pattern: /\b(ignore|do not worry about)\s+(chest pain|shortness of breath|suicidal thoughts|severe hypoglycemia)\b/i, reason: 'Dangerous dismissal of medical red flags' },
  { pattern: /\b(guaranteed|100% effective|miracle)\s+(remedy|treatment|cure|herb|drink)\b/i, reason: 'Pseudoscientific miracle cure claims' },
];

// Standard clinical parameter ranges for sanity checks
const CLINICAL_BENCHMARKS = {
  hba1c: {
    normalMax: 5.7,
    prediabetesMax: 6.4,
    diabetesMin: 6.5,
    unit: '%',
  },
  blood_glucose: {
    hypoThreshold: 70,
    fastingNormalMax: 99,
    fastingDiabetesMin: 126,
    unit: 'mg/dL',
  },
};

/**
 * Calculate n-gram / lexical grounding overlap between structured claim and raw text.
 * @param {string} claim
 * @param {string} rawText
 * @returns {number} Float 0.0 - 1.0
 */
function calculateClaimGroundingScore(claim, rawText) {
  if (!claim || !rawText) return 0;

  const rawTokens = new Set(
    rawText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const claimTokens = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (claimTokens.length === 0) return 1.0;

  let matched = 0;
  for (const token of claimTokens) {
    if (rawTokens.has(token)) matched += 1;
  }

  return matched / claimTokens.length;
}

/**
 * Validate a structured medical document for safety, taxonomy, grounding, and numerical accuracy.
 * @param {object} doc - Document object with raw_content, structured_content, domain, topic
 * @returns {{ isValid: boolean, score: number, issues: string[], warnings: string[], groundingScore: number, benchmarkChecks: object }}
 */
function validateDocumentClaims(doc) {
  const issues = [];
  const warnings = [];

  // 1. Taxonomy Validation
  const taxCheck = validateTaxonomyPayload({
    domain: doc.domain,
    subdomain: doc.subdomain,
    topic: doc.topic,
    subtopic: doc.subtopic,
  });

  if (!taxCheck.valid) {
    issues.push(`Taxonomy error: ${taxCheck.errors.join('; ')}`);
  }

  const rawText = doc.raw_content || '';
  const structured = doc.structured_content || {};
  const allTextToCheck = [
    rawText,
    structured.summary || '',
    ...(structured.sections || []).map((s) => `${s.heading} ${s.content} ${(s.key_points || []).join(' ')}`),
  ].join(' ');

  // 2. Dangerous Claims Detection
  for (const item of DANGEROUS_CLAIM_PATTERNS) {
    if (item.pattern.test(allTextToCheck)) {
      issues.push(`Dangerous medical claim detected: ${item.reason}`);
    }
  }

  // 3. Grounding Verification
  let totalGroundingScore = 0;
  let keyPointCount = 0;

  if (Array.isArray(structured.sections)) {
    for (const sec of structured.sections) {
      for (const kp of sec.key_points || []) {
        keyPointCount += 1;
        const gScore = calculateClaimGroundingScore(kp, rawText);
        totalGroundingScore += gScore;
        if (gScore < 0.35) {
          warnings.push(`Low grounding confidence for key point: "${kp.slice(0, 80)}..."`);
        }
      }
    }
  }

  const avgGroundingScore = keyPointCount > 0 ? totalGroundingScore / keyPointCount : 1.0;
  if (avgGroundingScore < 0.50 && rawText.length > 50) {
    issues.push(`Average claim grounding score (${(avgGroundingScore * 100).toFixed(1)}%) is below acceptable clinical threshold (50%)`);
  }

  // 4. Clinical Benchmark Consistency Checks
  const benchmarkChecks = {
    hba1cTested: false,
    glucoseTested: false,
  };

  if (doc.topic === 'hba1c' || allTextToCheck.includes('hba1c') || allTextToCheck.includes('a1c')) {
    benchmarkChecks.hba1cTested = true;
    // Check if 6.5% or 7.0% or 5.7% are mentioned appropriately if numbers appear
    const a1cNums = allTextToCheck.match(/\b\d+(\.\d+)?%/g) || [];
    if (a1cNums.length > 0) {
      const parsedValues = a1cNums.map((v) => parseFloat(v));
      const hasValidRanges = parsedValues.some((v) => v >= 4.0 && v <= 15.0);
      if (!hasValidRanges) {
        warnings.push('Unusual HbA1c percentages detected outside 4.0% - 15.0% range');
      }
    }
  }

  if (doc.topic === 'blood_glucose' || doc.topic === 'hypoglycemia' || allTextToCheck.includes('mg/dl')) {
    benchmarkChecks.glucoseTested = true;
    const mgdlNums = allTextToCheck.match(/\b\d+\s*mg\/d[lL]\b/g) || [];
    if (mgdlNums.length > 0) {
      const parsed = mgdlNums.map((v) => parseInt(v.replace(/\D/g, ''), 10));
      const hasExtreme = parsed.some((v) => v < 20 || v > 800);
      if (hasExtreme) {
        warnings.push('Extremely unusual glucose concentrations detected outside 20-800 mg/dL');
      }
    }
  }

  // Compute final safety & quality score (0.0 to 1.0)
  let score = 1.0;
  if (issues.length > 0) score -= issues.length * 0.35;
  if (warnings.length > 0) score -= warnings.length * 0.05;
  score = Math.max(0, Math.min(1.0, score));

  const isValid = issues.length === 0 && score >= 0.70;

  return {
    isValid,
    score: parseFloat(score.toFixed(2)),
    issues,
    warnings,
    groundingScore: parseFloat(avgGroundingScore.toFixed(2)),
    benchmarkChecks,
  };
}

module.exports = {
  validateDocumentClaims,
  calculateClaimGroundingScore,
  DANGEROUS_CLAIM_PATTERNS,
  CLINICAL_BENCHMARKS,
};
