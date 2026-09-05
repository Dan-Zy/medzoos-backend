/**
 * App capability / booking-help scope.
 *
 * Questions like "can you book an appointment for me if I give doctor name"
 * (EN + Roman Urdu) must NOT run clinical risk triage.
 */

function createId(prefix = 'action') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeMessage(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bdocotr\b/g, 'doctor')
    .replace(/\bdocter\b/g, 'doctor')
    .replace(/\bapointment\b/g, 'appointment')
    .replace(/\bkia\b/g, 'kya')
    .replace(/\bmary\b/g, 'mere')
    .replace(/\bmery\b/g, 'mere')
    .replace(/\blia\b/g, 'liye')
    .replace(/\btmy\b/g, 'tumhe')
    .replace(/\btumhain\b/g, 'tumhe')
    .replace(/\bskty\b/g, 'sakte')
    .replace(/\bsaktey\b/g, 'sakte')
    .replace(/\bkr\b/g, 'kar')
    .replace(/\bdu\b/g, 'doon')
    .trim();
}

/** Capability / “can you do X for me” booking asks */
function isBookingCapabilityAsk(message) {
  const text = normalizeMessage(message);

  const hasBooking =
    /\b(appointment|booking|book|appoint)\b/i.test(text) ||
    /\b(appointment\s*book|book\s*kar|book\s*kr|mulaqat|milao)\b/i.test(text);

  const hasDoctor =
    /\b(doctor|dr\.?|specialist|clinic|hospital)\b/i.test(text) ||
    /\b(doctor\s*ka\s*naam|dr\s*ka\s*naam)\b/i.test(text);

  const capabilityCue =
    /\b(can you|could you|will you|are you able|do you book|help me book|book (it |an? |my )?for me)\b/i.test(
      text,
    ) ||
    /\b(kya\s+tum|kya\s+aap|tum\s+.*\s+sakte|aap\s+.*\s+sakte|mere\s+liye|mary\s+lia|mere\s+lia)\b/i.test(
      text,
    ) ||
    /\b(if i (give|provide|share)|agr\s+ma|agar\s+main|detail\s+provide|naam\s+.*\s+detail)\b/i.test(
      text,
    );

  // Direct how-to booking without symptoms
  const howToBook =
    /\b(how (do|can) i book|how to book|where (do|can) i book)\b/i.test(text) ||
    /\b(appointment\s+kaise|kaise\s+book|book\s+kaise)\b/i.test(text);

  const hasClinicalSymptom =
    /\b(pain|fever|chest|cough|dizzy|vomit|bleeding|breath|ache|hurt|bukhar|dard|seene)\b/i.test(
      text,
    );

  if (hasClinicalSymptom) return false;

  if (howToBook && (hasBooking || hasDoctor)) return true;
  if (hasBooking && capabilityCue) return true;
  if (hasBooking && hasDoctor && capabilityCue) return true;
  if (hasBooking && /\b(for me|mere liye|mere lia)\b/i.test(text)) return true;

  return false;
}

function isGeneralCapabilityAsk(message) {
  const text = normalizeMessage(message);
  if (isBookingCapabilityAsk(message)) return false;

  return (
    /\b(what can you do|how can you help|can you help me|your features)\b/i.test(text) ||
    /\b(tum\s+kya\s+kar\s+sakte|aap\s+kya\s+kar\s+sakte|kis\s+tarah\s+madad)\b/i.test(text)
  );
}

function bookingActions() {
  return [
    {
      id: createId(),
      type: 'book_doctor',
      label: 'Find & book a doctor',
      reason: 'Search by name or specialty, then pick a slot in the app.',
      priority: 95,
      targetScreen: 'DoctorsList',
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'DoctorsList' },
      },
    },
    {
      id: createId(),
      type: 'book_doctor',
      label: 'Browse hospitals',
      reason: 'Open a hospital and book from its doctor list.',
      priority: 80,
      targetScreen: 'HospitalsList',
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: { screen: 'HospitalsList' },
      },
    },
  ];
}

const BOOKING_HELP_TEXT = [
  'Haan — Medzoos par appointment book ho sakti hai, lekin chat mein aap ki personal details lekar main booking complete nahi karta (privacy + safety).',
  '',
  'Aap yeh karain:',
  '1. Neeche “Find & book a doctor” tap karein',
  '2. Doctor ka naam ya specialty search karein',
  '3. Online ya in-person choose karein, date/time select karein, aur confirm karein',
  '',
  'Yes — I can help you get to booking, but I don’t take card/ID details in chat. Use the doctor booking flow in the app so your appointment is saved securely.',
].join('\n');

const GENERAL_CAPABILITY_TEXT = [
  'Main Medzoos Health Copilot hoon. Main yeh madad kar sakta hoon:',
  '• Doctor / hospital dhundna aur booking screen tak le jana',
  '• Lab tests aur medicines ke shortcuts',
  '• Symptoms par educational care guidance (diagnosis nahi)',
  '',
  'Appointment khud app ke Book flow se confirm hoti hai — chat mein details share karne ki zaroorat nahi.',
].join('\n');

/**
 * @param {string} message
 * @returns {null | object}
 */
function tryHandleCapabilityScope(message) {
  if (isBookingCapabilityAsk(message)) {
    return {
      text: BOOKING_HELP_TEXT,
      triageLevel: 'SELF_CARE',
      riskLevel: 'low',
      reasonCode: 'APP_BOOKING_HELP',
      emergency: false,
      actions: bookingActions(),
      suggestedReplies: [
        'Find a doctor near me',
        'Book online consult',
        'I have fever since last night',
      ],
      reasoning: 'Booking capability question — not clinical triage.',
      differentials: [],
      metadata: { protocol: 'capability_scope', scope: 'booking_help' },
    };
  }

  if (isGeneralCapabilityAsk(message)) {
    return {
      text: GENERAL_CAPABILITY_TEXT,
      triageLevel: 'SELF_CARE',
      riskLevel: 'low',
      reasonCode: 'APP_CAPABILITY_HELP',
      emergency: false,
      actions: bookingActions(),
      suggestedReplies: [
        'Find a doctor',
        'Book a lab test',
        'What is Medzoos?',
      ],
      reasoning: 'General capability question — not clinical triage.',
      differentials: [],
      metadata: { protocol: 'capability_scope', scope: 'general_help' },
    };
  }

  return null;
}

module.exports = {
  tryHandleCapabilityScope,
  isBookingCapabilityAsk,
  isGeneralCapabilityAsk,
  normalizeMessage,
  BOOKING_HELP_TEXT,
};
