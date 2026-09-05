/**
 * Normalize user text for deterministic pattern matching.
 * Supports English + Roman Urdu (Roman English) medical / app chat.
 */

const CLINICAL_AND_PHRASE_MAP = [
  [/\bbreathlessness\b/g, 'shortness of breath'],
  [/\bsoa\b/g, 'shortness of breath'],
  [/\bsob\b/g, 'shortness of breath'],
  [/\bcp\b/g, 'chest pain'],
  [/\bhr\b/g, 'heart'],
  [/\bmi\b/g, 'heart attack'],
  [/\bhaemorrhage\b/g, 'hemorrhage'],
  [/\bhaematemesis\b/g, 'vomiting blood'],
  [/\bhaemoptysis\b/g, 'coughing blood'],
  [/\bmelena\b/g, 'black tarry stool'],
  [/\bmelaena\b/g, 'black tarry stool'],
  [/\bsyncope\b/g, 'loss of consciousness'],
  [/\bfainted\b/g, 'loss of consciousness'],
  [/\bpassed out\b/g, 'loss of consciousness'],
  [/\bunconscious\b/g, 'loss of consciousness'],
  [/\banaphylactic\b/g, 'anaphylaxis'],
  [/\ballergic shock\b/g, 'anaphylaxis'],

  // Typos
  [/\bdocotr\b/g, 'doctor'],
  [/\bdocter\b/g, 'doctor'],
  [/\bapointment\b/g, 'appointment'],
  [/\bappoinment\b/g, 'appointment'],
  [/\bmedcine\b/g, 'medicine'],
  [/\bmedicne\b/g, 'medicine'],
  [/\btel\b/g, 'tell'],
  [/\bpls\b/g, 'please'],
  [/\bplz\b/g, 'please'],

  // Roman Urdu symptom phrases → English clinical tokens
  [/\bsans phool\b/g, 'shortness of breath'],
  [/\bsaans phool\b/g, 'shortness of breath'],
  [/\bsans nahi aa\b/g, 'cannot breathe'],
  [/\bsaans nahi aa rahi\b/g, 'cannot breathe'],
  [/\bsans nahi aa rahi\b/g, 'cannot breathe'],
  [/\bseene mein dard\b/g, 'chest pain'],
  [/\bseene ka dard\b/g, 'chest pain'],
  [/\bseenay mein dard\b/g, 'chest pain'],
  [/\bseene m dard\b/g, 'chest pain'],
  [/\bbahut tez bukhar\b/g, 'high fever'],
  [/\btez bukhar\b/g, 'high fever'],
  [/\bbukhar\b/g, 'fever'],
  [/\bkamar dard\b/g, 'back pain'],
  [/\bkamar mein dard\b/g, 'back pain'],
  [/\bkamar ka dard\b/g, 'back pain'],
  [/\bkamar m dard\b/g, 'back pain'],
  [/\bsir dard\b/g, 'headache'],
  [/\bsar dard\b/g, 'headache'],
  [/\bsirdard\b/g, 'headache'],
  [/\bsar mein dard\b/g, 'headache'],
  [/\bpet dard\b/g, 'stomach pain'],
  [/\bpet mein dard\b/g, 'stomach pain'],
  [/\bpeet dard\b/g, 'stomach pain'],
  [/\bqai\b/g, 'vomit'],
  [/\bulti\b/g, 'vomit'],
  [/\bmatli\b/g, 'nausea'],
  [/\bkhansi\b/g, 'cough'],
  [/\bkhnsi\b/g, 'cough'],
  [/\bzukaam\b/g, 'cold'],
  [/\bjukaam\b/g, 'cold'],
  [/\bnak se pani\b/g, 'runny nose'],
  [/\bchakkar\b/g, 'dizzy'],
  [/\bchkr\b/g, 'dizzy'],
  [/\bbehosh\b/g, 'loss of consciousness'],
  [/\bghabrahat\b/g, 'anxiety'],
  [/\budasi\b/g, 'depression'],
  [/\bneend nahi\b/g, 'insomnia'],
  [/\bneend ni\b/g, 'insomnia'],
  [/\bthakan\b/g, 'fatigue'],
  [/\bjism dard\b/g, 'body ache'],
  [/\bbadan dard\b/g, 'body ache'],
  [/\bpeechay se khoon\b/g, 'rectal bleeding'],
  [/\bkhoon qai\b/g, 'vomiting blood'],
  [/\bshugar\b/g, 'diabetes'],
  [/\bbp high\b/g, 'high blood pressure'],
  [/\bpressure high\b/g, 'high blood pressure'],

  // Intent vocabulary
  [/\bdawai\b/g, 'medicine'],
  [/\bdawa\b/g, 'medicine'],
  [/\bdawayi\b/g, 'medicine'],
  [/\breport samjhao\b/g, 'explain lab report'],
  [/\bmulaqat\b/g, 'appointment'],
  [/\bmilao\b/g, 'appointment'],
  [/\bbook karo\b/g, 'book'],
  [/\bbook karen\b/g, 'book'],
  [/\bbook kar\b/g, 'book'],
  [/\bhelp chahiye\b/g, 'help'],
  [/\brehnumai\b/g, 'guidance'],
  [/\brahnumai\b/g, 'guidance'],
];

/** Only applied when message looks like Roman Urdu (avoid breaking English). */
const ROMAN_PARTICLE_MAP = [
  [/\bkia\b/g, 'kya'],
  [/\bkyaa\b/g, 'kya'],
  [/\bmary\b/g, 'mere'],
  [/\bmery\b/g, 'mere'],
  [/\bmerey\b/g, 'mere'],
  [/\bmujhay\b/g, 'mujhe'],
  [/\bmujhy\b/g, 'mujhe'],
  [/\btmy\b/g, 'tumhe'],
  [/\btumhain\b/g, 'tumhe'],
  [/\btumhen\b/g, 'tumhe'],
  [/\blia\b/g, 'liye'],
  [/\blye\b/g, 'liye'],
  [/\bkr\b/g, 'kar'],
  [/\bkro\b/g, 'karo'],
  [/\bkrn\b/g, 'karen'],
  [/\bkrein\b/g, 'karen'],
  [/\bskty\b/g, 'sakte'],
  [/\bsaktey\b/g, 'sakte'],
  [/\bdu\b/g, 'doon'],
  [/\bagr\b/g, 'agar'],
  [/\bnhi\b/g, 'nahi'],
  [/\bnahin\b/g, 'nahi'],
  [/\bbht\b/g, 'bahut'],
  [/\bbuht\b/g, 'bahut'],
  [/\bzyda\b/g, 'zyada'],
  [/\bzayada\b/g, 'zyada'],
  [/\bthoda\b/g, 'thora'],
  [/\bkch\b/g, 'kuch'],
  [/\bwja\b/g, 'wajah'],
  [/\bmaslah\b/g, 'masla'],
  [/\btkleef\b/g, 'takleef'],
  [/\bprsani\b/g, 'pareshani'],
  [/\bhy\b/g, 'hai'],
  [/\bmien\b/g, 'mein'],
];

const ROMAN_MARKERS =
  /\b(kya|kia|hai|hain|ho|hun|hoon|he|hn|nahi|nhi|nhn|mat|mujhe|mujhay|mujy|mere|meri|mera|mary|mery|aap|ap|tum|bahut|bht|bohat|zyada|zada|thora|thoda|kuch|kch|mein|me|mai|liye|lia|lye|sakte|skte|skty|karo|kro|karen|krn|krna|karna|takleef|dard|bukhar|dawai|madad|wajah|masla|pareshani|ghabrahat|neend|thakan|kaise|kese|kyun|ku|agar|agr|phr|phir|toh|to|bhi|bh|or|aur|ar|batao|btao|bataen|dikhao|dkho|chahiye|chahye|sakta|saktee|shukriya|shukria|theek|thik|sahih|sahi)\b/i;

/**
 * @param {string} input
 * @returns {'roman_ur'|'en'|'ur'}
 */
function detectUserLanguage(input) {
  const raw = String(input || '').trim();
  // Arabic / Urdu script detection
  if (/[\u0600-\u06FF]/.test(raw)) return 'ur';
  if (ROMAN_MARKERS.test(raw.toLowerCase())) return 'roman_ur';
  return 'en';
}

/**
 * @param {string} input
 * @returns {string}
 */
function normalizeText(input) {
  if (!input || typeof input !== 'string') return '';

  const language = detectUserLanguage(input);

  let text = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/[^\w\s+./°-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (language === 'roman_ur') {
    for (const [pattern, replacement] of ROMAN_PARTICLE_MAP) {
      text = text.replace(pattern, replacement);
    }
  }

  for (const [pattern, replacement] of CLINICAL_AND_PHRASE_MAP) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {Set<string>}
 */
function tokenize(text) {
  const normalized = normalizeText(text);
  return new Set(normalized.split(/\s+/).filter(Boolean));
}

/**
 * @param {string} text
 * @param {string[]} required
 * @param {string[]} [anyOf]
 * @param {string[]} [exclusions]
 * @returns {boolean}
 */
function matchesTokenRule(text, required, anyOf = [], exclusions = []) {
  const normalized = normalizeText(text);
  for (const ex of exclusions) {
    if (normalized.includes(ex)) return false;
  }
  for (const req of required) {
    if (!normalized.includes(req)) return false;
  }
  if (anyOf.length === 0) return true;
  return anyOf.some((t) => normalized.includes(t));
}

module.exports = {
  normalizeText,
  detectUserLanguage,
  tokenize,
  matchesTokenRule,
};
