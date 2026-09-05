/**
 * Product / brand / competitor scope handler.
 *
 * "What is Medzoos?", "tell me about Marham", "what is oladoc" must NOT
 * go through clinical wellness triage or open-world LLM answers.
 * Same semantic question → same deterministic Medzoos-scoped reply.
 */

function createId(prefix = 'action') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const COMPETITORS = [
  { id: 'marham', patterns: [/\bmarham\b/i] },
  { id: 'oladoc', patterns: [/\boladoc\b/i, /\bola\s*doc\b/i] },
  { id: 'sehathub', patterns: [/\bsehat\s*kahani\b/i, /\bsehathub\b/i] },
  { id: 'docthern', patterns: [/\bdocthern\b/i] },
  { id: 'healthwire', patterns: [/\bhealth\s*wire\b/i, /\bhealthwire\b/i] },
  { id: 'findmyhealth', patterns: [/\bfind\s*my\s*doctor\b/i, /\bfindmydoctor\b/i] },
];

const ABOUT_QUERY =
  /\b(what\s+is|what'?s|whats|who\s+is|tell\s+me\s+about|can\s+you\s+tell\s+me\s+about|explain|about|kya\s+hai|kya\s+hota\s+hai)\b/i;

const MEDZOOS_MENTION = /\bmedzoos\b|\bmed\s*zoos\b|\bmed\s*zoo\b/i;

const PRODUCT_FEATURES =
  /\b(how\s+does\s+(medzoos|this\s+app)\s+work|what\s+can\s+(you|medzoos)\s+do|features?\s+of\s+medzoos|medzoos\s+app)\b/i;

function normalizeMessage(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\btel\b/g, 'tell') // common typo: "tel me"
    .trim();
}

function findCompetitor(message) {
  const text = normalizeMessage(message);
  for (const c of COMPETITORS) {
    if (c.patterns.some((p) => p.test(text))) return c.id;
  }
  return null;
}

function isAboutMedzoos(message) {
  const text = normalizeMessage(message);
  if (PRODUCT_FEATURES.test(text)) return true;
  if (MEDZOOS_MENTION.test(text) && ABOUT_QUERY.test(text)) return true;
  if (/^(what|who)\s+is\s+medzoos\??$/i.test(text)) return true;
  if (/^about\s+medzoos\??$/i.test(text)) return true;
  return false;
}

function isCompetitorQuery(message) {
  const competitor = findCompetitor(message);
  if (!competitor) return false;
  const text = normalizeMessage(message);

  // Clinical care always wins over brand chat
  const hasClinical =
    /\b(pain|fever|chest|cough|dizzy|symptom|hurt|ache|breath|vomit|bleeding|emergency|diabetes|medicine)\b/i.test(
      text,
    );
  if (hasClinical && !ABOUT_QUERY.test(text)) {
    return false;
  }

  if (ABOUT_QUERY.test(text)) return true;
  if (MEDZOOS_MENTION.test(text) && /\b(vs|versus|or|better|compare|comparison)\b/i.test(text)) {
    return true;
  }
  // Short asks: "marham", "what oladoc", "tell me marham"
  if (text.split(/\s+/).length <= 8) return true;
  return false;
}

/**
 * @param {string} message
 * @returns {{ kind: 'about_medzoos'|'competitor'|null, competitorId?: string|null }}
 */
function detectProductScope(message) {
  if (!message || !String(message).trim()) return { kind: null };

  // Competitors first — never let RAG/LLM explain them
  const competitorId = findCompetitor(message);
  if (competitorId && isCompetitorQuery(message)) {
    return { kind: 'competitor', competitorId };
  }

  if (isAboutMedzoos(message)) {
    return { kind: 'about_medzoos', competitorId: null };
  }

  return { kind: null };
}

function productActions() {
  return [
    {
      id: createId(),
      type: 'book_doctor',
      label: 'Find a doctor',
      reason: 'Browse specialists and book online or in-person.',
      priority: 90,
      targetScreen: 'DoctorsList',
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'DoctorsList' },
      },
    },
    {
      id: createId(),
      type: 'book_lab',
      label: 'Book a lab test',
      reason: 'Schedule home collection or walk-in labs.',
      priority: 80,
      targetScreen: 'LabTestsList',
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'LabTestsList' },
      },
    },
    {
      id: createId(),
      type: 'order_medicine',
      label: 'Order medicines',
      reason: 'Order from partner pharmacies in Medzoos.',
      priority: 70,
      targetScreen: 'MedicinesList',
      navigation: {
        tab: 'Health',
        screen: 'MedicinesList',
      },
    },
  ];
}

const ABOUT_MEDZOOS_TEXT = [
  'Medzoos is your Pakistan healthcare companion in this app.',
  '',
  'You can:',
  '• Book doctors — online video or in-person at partner hospitals',
  '• Book lab tests — home collection or walk-in',
  '• Order medicines from partner pharmacies',
  '• Keep health records and family profiles',
  '• Chat with me (Health Copilot) for guided care tips — not a diagnosis',
  '',
  'I only help inside Medzoos. Tell me what you need — a doctor, a lab test, medicines, or a health question.',
].join('\n');

function competitorRedirectText() {
  return [
    "I'm Medzoos Health Copilot — I only help inside the Medzoos app.",
    '',
    "I don't provide information about other healthcare platforms.",
    '',
    'On Medzoos you can book doctors (online or in-person), lab tests, and medicines, plus get educational care guidance here in chat.',
    '',
    'What would you like to do in Medzoos?',
  ].join('\n');
}

/**
 * @param {string} message
 * @returns {null | {
 *   text: string,
 *   triageLevel: 'SELF_CARE',
 *   riskLevel: 'low',
 *   reasonCode: string,
 *   emergency: false,
 *   actions: object[],
 *   suggestedReplies: string[],
 *   reasoning: string,
 *   differentials: [],
 *   metadata: object,
 * }}
 */
function tryHandleProductScope(message) {
  const scope = detectProductScope(message);
  if (!scope.kind) return null;

  const suggestedReplies = [
    'Find a doctor near me',
    'I have fever since last night',
    'Book a lab test',
    'Order medicine',
  ];

  if (scope.kind === 'about_medzoos') {
    return {
      text: ABOUT_MEDZOOS_TEXT,
      triageLevel: 'SELF_CARE',
      riskLevel: 'low',
      reasonCode: 'PRODUCT_ABOUT_MEDZOOS',
      emergency: false,
      actions: productActions(),
      suggestedReplies,
      reasoning: 'Deterministic Medzoos product explanation — no clinical triage.',
      differentials: [],
      metadata: {
        protocol: 'product_scope',
        scope: 'about_medzoos',
      },
    };
  }

  return {
    text: competitorRedirectText(),
    triageLevel: 'SELF_CARE',
    riskLevel: 'low',
    reasonCode: 'PRODUCT_COMPETITOR_REDIRECT',
    emergency: false,
    actions: productActions(),
    suggestedReplies,
    reasoning: 'Competitor mention blocked — Medzoos-scoped redirect only.',
    differentials: [],
    metadata: {
      protocol: 'product_scope',
      scope: 'competitor_redirect',
      competitorId: scope.competitorId,
    },
  };
}

module.exports = {
  detectProductScope,
  tryHandleProductScope,
  COMPETITORS,
  ABOUT_MEDZOOS_TEXT,
  normalizeMessage,
};
