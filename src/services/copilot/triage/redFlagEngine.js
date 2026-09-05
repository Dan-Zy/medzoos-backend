/**
 * Layer 1 — Deterministic Red-Flag Fast Path
 *
 * MUST run before any LLM call.
 * Application triage policy v2026-08-01 (not certified ESI/MTS).
 * Source: Medzoos safety policy — review status: draft clinical ops.
 */

const { normalizeText, matchesTokenRule } = require('./textNormalizer');

/**
 * @typedef {Object} RedFlagRule
 * @property {string} reasonCode
 * @property {string} category
 * @property {(text: string) => boolean} test
 * @property {string} patientReason
 */

/** @type {RedFlagRule[]} */
const RED_FLAG_RULES = [
  // ——— Psychiatric Crisis / Suicide & Self-Harm ———
  {
    reasonCode: 'CRISIS_SUICIDE_SELF_HARM_RED_FLAG',
    category: 'psychiatric_crisis',
    patientReason: 'Mental health crisis or self-harm risk detected. Immediate support is available: Umang Helpline 0311-7786264 or Emergency 1122.',
    test: (t) =>
      matchesTokenRule(t, ['suicide']) ||
      matchesTokenRule(t, ['suicidal']) ||
      matchesTokenRule(t, ['kill myself']) ||
      matchesTokenRule(t, ['end my life']) ||
      matchesTokenRule(t, ['ending my life']) ||
      matchesTokenRule(t, ['feel like dying']) ||
      matchesTokenRule(t, ['want to die']) ||
      matchesTokenRule(t, ['self harm']) ||
      matchesTokenRule(t, ['cutting myself']) ||
      matchesTokenRule(t, ['khudkushi']) ||
      matchesTokenRule(t, ['marne ka dil']) ||
      matchesTokenRule(t, ['zindagi khatam']) ||
      matchesTokenRule(t, ['zindagi se tang']) ||
      matchesTokenRule(t, ['khud ko marna']) ||
      matchesTokenRule(t, ['apne aap ko nuqsan']) ||
      matchesTokenRule(t, ['no reason to live']),
  },
  // ——— Cardiovascular ———
  {
    reasonCode: 'CHEST_PAIN_RED_FLAG',
    category: 'cardiovascular',
    patientReason: 'A potentially life-threatening chest symptom pattern was detected.',
    test: (t) =>
      matchesTokenRule(t, ['chest'], ['crushing', 'pressure', 'squeezing', 'tightness']) ||
      matchesTokenRule(t, ['chest pain'], ['left arm', 'arm', 'baazu', 'bazu', 'jaw', 'neck', 'radiat']) ||
      matchesTokenRule(t, ['chest pain'], ['sweat', 'clammy', 'diaphores', 'pasena', 'pasenay', 'paseena']) ||
      matchesTokenRule(t, ['chest pain'], ['shortness of breath', 'cannot breathe', 'breathless', 'ghabrahat']) ||
      matchesTokenRule(t, ['heart attack']) ||
      matchesTokenRule(t, ['seene mein dard'], ['baazu', 'bazu', 'pasena', 'pasenay', 'paseena']) ||
      matchesTokenRule(t, ['chest'], ['crushing']),
  },
  // ——— Neurological / stroke ———
  {
    reasonCode: 'STROKE_FAST_RED_FLAG',
    category: 'neurological',
    patientReason: 'Sudden neurological symptoms that may indicate a stroke were detected.',
    test: (t) =>
      matchesTokenRule(t, ['facial'], ['droop', 'drooping']) ||
      matchesTokenRule(t, ['one sided'], ['weak', 'weakness', 'paralysis']) ||
      matchesTokenRule(t, ['sudden'], ['inability to speak', 'cannot speak', 'slurred speech']) ||
      matchesTokenRule(t, ['adha jism sunn']) ||
      matchesTokenRule(t, ['bolne mein'], ['dushwari', 'takleef']) ||
      matchesTokenRule(t, ['new paralysis']) ||
      matchesTokenRule(t, ['stroke']) ||
      matchesTokenRule(t, ['slurred speech']),
  },
  // ——— Severe Hypoglycemia (Diabetes Metabolic Emergency) ———
  {
    reasonCode: 'SEVERE_HYPOGLYCEMIA_RED_FLAG',
    category: 'metabolic',
    patientReason: 'Critically low blood sugar (<54 mg/dL or hypoglycemia with unconsciousness/seizure) was detected.',
    test: (t) => {
      const m =
        t.match(/\b(?:sugar|glucose)\s*(?:level|reading|hai)?\s*(\d{1,3})\s*(?:mg\/dl)?/i) ||
        t.match(/\b(\d{1,3})\s*mg\/dl\b/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > 0 && val < 54) return true;
      }
      return (
        matchesTokenRule(t, ['sugar', 'glucose'], ['behosh', 'unconscious', 'fainted', 'seizure', 'passed out', 'coma']) ||
        matchesTokenRule(t, ['low sugar', 'hypoglycemia'], ['behosh', 'unconscious', 'fainted', 'confusion'])
      );
    },
  },
  // ——— DKA / Hyperglycemic Crisis ———
  {
    reasonCode: 'DKA_CRISIS_RED_FLAG',
    category: 'metabolic',
    patientReason: 'Suspected Diabetic Ketoacidosis (DKA) or severe hyperglycemic crisis was detected.',
    test: (t) => {
      const highMatch =
        t.match(/\b(?:sugar|glucose)\s*(?:level|hai)?\s*(\d{3})\b/i) ||
        t.match(/\b(\d{3})\s*mg\/dl\b/i);
      const isHighSugar =
        (highMatch && parseInt(highMatch[1], 10) >= 250) ||
        matchesTokenRule(t, ['sugar', 'glucose'], ['300', '350', '400', '450', '500', 'high', 'bohat tez']) ||
        matchesTokenRule(t, ['high blood sugar', 'hyperglycemia']);
      if (!isHighSugar) return false;
      return (
        matchesTokenRule(t, [], ['vomit', 'vomiting', 'ulti', 'ketone', 'ketones', 'fruity breath', 'meethi boo']) ||
        matchesTokenRule(t, [], ['rapid breathing', 'kussmaul', 'tezi se sans'])
      );
    },
  },
  // ——— Neurological / General Syncope & Loss of Consciousness ———
  {
    reasonCode: 'LOSS_OF_CONSCIOUSNESS',
    category: 'neurological',
    patientReason: 'Loss of consciousness, syncope, or seizure-like symptoms were detected.',
    test: (t) =>
      matchesTokenRule(t, ['loss of consciousness']) ||
      matchesTokenRule(t, ['loss of conciousness']) ||
      matchesTokenRule(t, ['lost consciousness']) ||
      matchesTokenRule(t, ['lost conciousness']) ||
      matchesTokenRule(t, ['passed out']) ||
      matchesTokenRule(t, ['passing out']) ||
      matchesTokenRule(t, ['blacked out']) ||
      matchesTokenRule(t, ['blackout']) ||
      matchesTokenRule(t, ['fainted']) ||
      matchesTokenRule(t, ['fainting']) ||
      matchesTokenRule(t, ['unconscious']) ||
      matchesTokenRule(t, ['unconcious']) ||
      matchesTokenRule(t, ['unresponsive']) ||
      matchesTokenRule(t, ['unresponsiveness']) ||
      matchesTokenRule(t, ['syncope']) ||
      matchesTokenRule(t, ['behosh']) ||
      matchesTokenRule(t, ['be hosh']) ||
      matchesTokenRule(t, ['gash']) ||
      matchesTokenRule(t, ['seizure']) ||
      matchesTokenRule(t, ['sudden'], ['severe confusion', 'confused']) ||
      matchesTokenRule(t, ['coma']),
  },
  // ——— Respiratory ———
  {
    reasonCode: 'SEVERE_DYSPNEA_RED_FLAG',
    category: 'respiratory',
    patientReason: 'Severe breathing difficulty was detected.',
    test: (t) =>
      matchesTokenRule(t, ['cannot breathe']) ||
      matchesTokenRule(t, ['severe'], ['difficulty breathing', 'shortness of breath', 'respiratory distress']) ||
      matchesTokenRule(t, ['blue lips']) ||
      matchesTokenRule(t, ['gasping']) ||
      matchesTokenRule(t, ['respiratory distress']) ||
      matchesTokenRule(t, ['choking']),
  },
  // ——— Anaphylaxis ———
  {
    reasonCode: 'ANAPHYLAXIS',
    category: 'anaphylaxis',
    patientReason: 'A possible severe allergic reaction (anaphylaxis) pattern was detected.',
    test: (t) =>
      matchesTokenRule(t, ['throat'], ['swelling', 'swollen']) ||
      matchesTokenRule(t, ['tongue'], ['swelling', 'swollen']) ||
      matchesTokenRule(t, ['anaphylaxis']) ||
      (matchesTokenRule(t, ['difficulty breathing'], []) &&
        matchesTokenRule(t, [], ['allerg', 'allergen', 'sting', 'peanut'])) ||
      matchesTokenRule(t, ['collapse'], ['allerg', 'reaction']),
  },
  // ——— Major bleeding ———
  {
    reasonCode: 'MAJOR_BLEEDING',
    category: 'bleeding',
    patientReason: 'A major bleeding pattern was detected.',
    test: (t) =>
      matchesTokenRule(t, ['uncontrolled bleeding']) ||
      matchesTokenRule(t, ['vomiting'], ['blood', 'large amounts of blood']) ||
      matchesTokenRule(t, ['coughing'], ['blood', 'large amounts of blood']) ||
      matchesTokenRule(t, ['black tarry stool'], ['weak', 'collapse', 'dizzy']) ||
      matchesTokenRule(t, ['hemorrhage']),
  },
  // ——— Poisoning ———
  {
    reasonCode: 'POISONING_OVERDOSE',
    category: 'poisoning',
    patientReason: 'A poisoning or overdose pattern was detected.',
    test: (t) =>
      matchesTokenRule(t, ['poisoning']) ||
      matchesTokenRule(t, ['overdose']) ||
      matchesTokenRule(t, ['toxic ingestion']) ||
      matchesTokenRule(t, ['chemical ingestion']) ||
      matchesTokenRule(t, ['swallowed'], ['poison', 'pesticide', 'bleach']),
  },
  // ——— Cauda equina / spinal ———
  {
    reasonCode: 'CAUDA_EQUINA_RED_FLAG',
    category: 'spinal',
    patientReason: 'Back pain with neurological red flags that may need emergency evaluation.',
    test: (t) => {
      const hasBack = t.includes('back pain') || t.includes('lower back') || t.includes('spine');
      if (!hasBack && !t.includes('saddle')) return false;
      return (
        matchesTokenRule(t, ['bowel'], ['incontinence']) ||
        matchesTokenRule(t, ['bladder'], ['incontinence']) ||
        matchesTokenRule(t, ['urinary retention']) ||
        matchesTokenRule(t, ['saddle anesthesia']) ||
        matchesTokenRule(t, ['saddle'], ['numb']) ||
        matchesTokenRule(t, ['progressive'], ['leg weakness', 'weakness']) ||
        matchesTokenRule(t, ['new'], ['bowel incontinence', 'bladder incontinence'])
      );
    },
  },

  // Explicit emergency request
  {
    reasonCode: 'EXPLICIT_EMERGENCY',
    category: 'emergency',
    patientReason: 'An emergency request was detected.',
    test: (t) =>
      matchesTokenRule(t, ['call'], ['1122', 'ambulance']) ||
      matchesTokenRule(t, ['emergency'], ['now', 'help', 'ambulance']) ||
      matchesTokenRule(t, ['ambulance']),
  },
];

/**
 * @param {string} userMessage
 * @returns {{ triggered: boolean, reasonCode: string|null, category: string|null, patientReason: string|null, matchedRules: string[] }}
 */
function evaluateRedFlags(userMessage) {
  const text = normalizeText(userMessage);
  const matched = [];

  for (const rule of RED_FLAG_RULES) {
    try {
      if (rule.test(text)) {
        matched.push(rule.reasonCode);
        return {
          triggered: true,
          reasonCode: rule.reasonCode,
          category: rule.category,
          patientReason: rule.patientReason,
          matchedRules: matched,
        };
      }
    } catch {
      // Ignore broken individual rules — fail safe by continuing
    }
  }

  return {
    triggered: false,
    reasonCode: null,
    category: null,
    patientReason: null,
    matchedRules: [],
  };
}

/**
 * Mild "chest pain" alone is NOT an automatic emergency — only combination rules above.
 * Exported for tests.
 */
function isIsolatedMildChestPain(userMessage) {
  const t = normalizeText(userMessage);
  if (!t.includes('chest pain') && !(t.includes('chest') && t.includes('pain'))) return false;
  const red = evaluateRedFlags(userMessage);
  return !red.triggered;
}

module.exports = {
  evaluateRedFlags,
  isIsolatedMildChestPain,
  RED_FLAG_RULES,
  normalizeText,
};
