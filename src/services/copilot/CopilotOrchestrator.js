/**
 * AI Health Copilot Orchestrator
 *
 * Clinical decisions go through ClinicalTriagePipeline (deterministic).
 * LLM is used only for greeting polish + structured extraction inside the pipeline.
 * LLM never sets triageLevel, risk, actions, or provider lists.
 */

const { loadHealthContext } = require('./HealthContextLoader');
const { loadTieredPatientContext } = require('./context/TieredPatientContext');
const { sanitizePii } = require('./guardrails/ClinicalGuardrailsEngine');
const { tryHandleProductScope } = require('./guardrails/productScopeHandler');
const { tryHandleCapabilityScope } = require('./guardrails/capabilityScopeHandler');
const { tryHandleUnclearIntent } = require('./understanding/intentUnderstanding');
const llmService = require('./LlmService');
const { runClinicalTriage } = require('./ClinicalTriagePipeline');
const { PROTOCOL_VERSION } = require('./types/copilot.types');
const { hybridRetrieve } = require('../knowledge/HybridRetrievalEngine');
const { searchHealthcareDirectory } = require('../knowledge/HealthcareDirectoryEngine');
const prisma = require('../../config/database');

const MEDICAL_DISCLAIMER =
  'These are educational hypotheses only — not a diagnosis. Only a qualified clinician can diagnose and treat you.';

const sessions = new Map();

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function generateGreeting(context) {
  const lines = [`${getTimeGreeting()} ${context.personal.firstName}.`];
  if (context.insights.length) {
    lines.push('', context.insights[0]);
  }
  lines.push('', 'How can I help you today?');
  return lines.join('\n');
}

function sanitizeSession(session) {
  return {
    sessionId: session.sessionId,
    phase: session.phase,
    intent: session.intent,
    riskLevel: session.riskLevel,
    triageLevel: session.triageLevel || null,
    completed: session.completed,
    protocolVersion: PROTOCOL_VERSION,
  };
}

/**
 * Map triage action types to legacy mobile action types where needed.
 */
function mapActionForMobile(action) {
  const typeMap = {
    call_emergency: 'emergency_alert',
    find_emergency_room: 'book_doctor',
    pharmacy: 'order_medicine',
    symptom_tracker: 'health_plan',
    follow_up: 'book_doctor',
  };
  return {
    id: action.id,
    type: typeMap[action.type] || action.type,
    label: action.label,
    reason: action.reason || '',
    priority: action.priority || 50,
    navigation: action.navigation,
    targetScreen: action.targetScreen,
    params: action.params,
  };
}

function triageToAssistantMessage(triage, userMsg) {
  const isConversational =
    triage.reasonCode === 'CONVERSATIONAL_RESPONSE' ||
    triage.reasonCode === 'HEALTHCARE_DIRECTORY_LOOKUP';

  return {
    id: createId(),
    role: 'assistant',
    text: triage.text,
    timestamp: new Date().toISOString(),
    intent: triage.metadata?.protocol || undefined,
    riskLevel: isConversational ? null : triage.riskLevel,
    triageLevel: isConversational ? null : triage.triageLevel,
    emergency: triage.emergency,
    reasonCode: triage.reasonCode,
    reasoning: triage.reasoning ? [triage.reasoning] : [],
    differentials: isConversational ? [] : (triage.differentials || []),
    actions: (triage.actions || []).map(mapActionForMobile),
    disclaimer: isConversational ? undefined : MEDICAL_DISCLAIMER,
    suggestedReplies: triage.suggestedReplies || [],
    providers: triage.providers || undefined,
    groundingData: triage.groundingData || undefined,
    citations: triage.groundingData?.citations || undefined,
    metadata: triage.metadata,
  };
}

async function createSession(userId) {
  const context = await loadHealthContext(userId);
  if (!context) throw new Error('User not found');
  const tieredContext = await loadTieredPatientContext(userId);

  const session = {
    sessionId: createId(),
    userId,
    phase: 'intent',
    intent: null,
    answers: {},
    questionIndex: 0,
    pendingQuestions: [],
    riskLevel: null,
    triageLevel: null,
    completed: false,
    context,
    tieredContext,
    askedQuestions: [],
    messages: [],
    triggerMessage: null,
  };

  const baseGreeting = generateGreeting(context);
  // Greeting polish only — never clinical decisions
  const greeting = await llmService.enhanceGreeting(context, baseGreeting);
  const greetingMsg = {
    id: createId(),
    role: 'assistant',
    text: greeting,
    timestamp: new Date().toISOString(),
    disclaimer: MEDICAL_DISCLAIMER,
    suggestedReplies: [
      'I have chest pain',
      'I need a doctor',
      'My back hurts',
      'I have fever since last night',
    ],
  };

  session.messages.push(greetingMsg);
  sessions.set(session.sessionId, session);

  // Async persist session to database if valid userId
  try {
    if (userId && typeof userId === 'string' && userId.length > 10) {
      await prisma.copilotSession.create({
        data: {
          id: session.sessionId,
          user_id: userId,
          phase: 'intent',
          status: 'active',
          context_snapshot: context,
        },
      }).catch(() => {});
    }
  } catch {
    // Graceful fallback if database schema differs
  }

  return { session: sanitizeSession(session), messages: [greetingMsg] };
}

async function sendMessage(userId, sessionId, text) {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) throw new Error('Session not found');

  const trimmed = text.trim();
  if (!trimmed) return { session: sanitizeSession(session), messages: [] };

  const userMsg = {
    id: createId(),
    role: 'user',
    text: trimmed,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  // Competitor deflection / payment safety scope
  const productScoped = tryHandleProductScope(trimmed);
  const capabilityScoped = productScoped || tryHandleCapabilityScope(trimmed);
  const unclearScoped = capabilityScoped;
  if (unclearScoped) {
    session.phase =
      unclearScoped.triageLevel === 'NEEDS_MORE_INFORMATION' ? 'clarification' : 'actions';
    session.completed = unclearScoped.triageLevel !== 'NEEDS_MORE_INFORMATION';
    session.triageLevel = unclearScoped.triageLevel;
    session.riskLevel = unclearScoped.riskLevel;
    session.intent = unclearScoped.reasonCode;
    session.triggerMessage = trimmed;
    if (unclearScoped.questionKey) {
      session.askedQuestions = session.askedQuestions || [];
      if (!session.askedQuestions.includes(unclearScoped.questionKey)) {
        session.askedQuestions.push(unclearScoped.questionKey);
      }
    }

    const assistantMsg = triageToAssistantMessage(unclearScoped, userMsg);
    session.messages.push(assistantMsg);

    try {
      if (userId && typeof userId === 'string' && userId.length > 10) {
        await prisma.copilotMessage.createMany({
          data: [
            {
              session_id: sessionId,
              role: 'user',
              content: sanitizePii(trimmed),
            },
            {
              session_id: sessionId,
              role: 'assistant',
              content: sanitizePii(assistantMsg.text),
              triage_level: unclearScoped.triageLevel,
              risk_level: unclearScoped.riskLevel,
              grounding_data: unclearScoped.metadata || null,
            },
          ],
        }).catch(() => {});
      }
    } catch {
      // Graceful fallback
    }

    return {
      session: sanitizeSession(session),
      messages: [userMsg, assistantMsg],
      triage: unclearScoped,
    };
  }

  // Accumulate clarification answers into session
  if (session.phase === 'clarification') {
    const idx = Object.keys(session.answers).length;
    session.answers[`clarify_${idx}`] = trimmed;
  } else {
    session.triggerMessage = trimmed;
    session.answers = {};
  }

  const combinedMessage = session.triggerMessage
    ? `${session.triggerMessage}. ${Object.values(session.answers).join('. ')}`.trim()
    : trimmed;

  const triage = await runClinicalTriage({
    userId,
    message: combinedMessage,
    session,
  });

  // 1. Check if user is asking for real-time Doctor or Hospital directory information
  if (!triage.emergency && triage.triageLevel !== 'EMERGENCY') {
    try {
      const directory = await searchHealthcareDirectory(combinedMessage);
      if (directory.found) {
        const dirResponse = await llmService.generateDirectoryResponse({
          userMessage: combinedMessage,
          directoryResult: directory,
          patientContext: session.tieredContext || session.context,
        });

        if (dirResponse && dirResponse.text) {
          triage.text = dirResponse.text;
          if (dirResponse.suggestedReplies && dirResponse.suggestedReplies.length > 0) {
            triage.suggestedReplies = dirResponse.suggestedReplies;
          }
          triage.actions = directory.actionCards;
          triage.triageLevel = 'SELF_CARE';
          triage.reasonCode = 'HEALTHCARE_DIRECTORY_LOOKUP';
          triage.groundingData = {
            directoryType: directory.type,
            city: directory.city,
            specialty: directory.specialty,
            hospitalsCount: directory.hospitals.length,
            doctorsCount: directory.doctors.length,
          };
        }
      } else {
        // 2. Hybrid RAG Knowledge Retrieval for medical guidelines & education
        const hybrid = await hybridRetrieve(combinedMessage, { limit: 3 });
        if (hybrid.results && hybrid.results.length > 0) {
          const grounded = await llmService.generateGroundedEducationalResponse({
            userMessage: combinedMessage,
            retrievedChunks: hybrid.results,
            triageResult: triage,
            patientContext: session.tieredContext || session.context,
          });

          if (grounded && grounded.text) {
            triage.text = grounded.text;
            if (grounded.suggestedReplies && grounded.suggestedReplies.length > 0) {
              triage.suggestedReplies = grounded.suggestedReplies;
            }
            triage.groundingData = {
              chunks: hybrid.results,
              citations: grounded.citations || [],
              queryTaxonomy: hybrid.queryTaxonomy,
            };
          }
        } else {
          // 3. Automatic Dynamic Conversational, Platform, Security & General Health Response
          const conversational = await llmService.generateConversationalResponse({
            userMessage: combinedMessage,
            patientContext: session.tieredContext || session.context,
          });

          if (conversational && conversational.text) {
            triage.text = conversational.text;
            if (conversational.suggestedReplies && conversational.suggestedReplies.length > 0) {
              triage.suggestedReplies = conversational.suggestedReplies;
            }
            // For general non-symptom questions, clear clinical urgency pill and irrelevant doctor cards
            if (!triage.chiefComplaint || triage.reasonCode === 'CLINICIAN_REVIEW_ADVISED') {
              triage.triageLevel = 'SELF_CARE';
              triage.riskLevel = null;
              triage.reasonCode = 'CONVERSATIONAL_RESPONSE';
              triage.actions = [];
            }
          }
        }
      }
    } catch (err) {
      // Fallback: triage.text from deterministic pipeline remains active
    }
  }

  if (triage.triageLevel === 'NEEDS_MORE_INFORMATION') {
    session.phase = 'clarification';
    session.completed = false;
    session.triageLevel = triage.triageLevel;
    session.riskLevel = null;
    if (triage.questionKey) {
      session.askedQuestions = session.askedQuestions || [];
      if (!session.askedQuestions.includes(triage.questionKey)) {
        session.askedQuestions.push(triage.questionKey);
      }
    }
  } else {
    session.phase = 'actions';
    session.completed = true;
    session.triageLevel = triage.triageLevel;
    session.riskLevel = triage.riskLevel;
    session.intent = triage.reasonCode;
  }

  const assistantMsg = triageToAssistantMessage(triage, userMsg);
  session.messages.push(assistantMsg);

  // Async persist conversation turn to database
  try {
    if (userId && typeof userId === 'string' && userId.length > 10) {
      await prisma.copilotMessage.createMany({
        data: [
          {
            session_id: sessionId,
            role: 'user',
            content: sanitizePii(trimmed),
          },
          {
            session_id: sessionId,
            role: 'assistant',
            content: sanitizePii(assistantMsg.text),
            triage_level: triage.triageLevel,
            risk_level: triage.riskLevel,
            grounding_data: triage.groundingData || null,
          },
        ],
      }).catch(() => {});
    }
  } catch {
    // Graceful fallback
  }

  return {
    session: sanitizeSession(session),
    messages: [userMsg, assistantMsg],
    triage,
  };
}

function getSession(userId, sessionId) {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) return null;
  return {
    session: sanitizeSession(session),
    messages: session.messages,
    context: {
      personal: session.context.personal,
      insights: session.context.insights,
    },
  };
}

/**
 * Stateless triage endpoint (no session required beyond auth).
 */
async function triageOnce(userId, message, priorAnswers = {}) {
  return runClinicalTriage({
    userId,
    message,
    session: { answers: priorAnswers },
  });
}

module.exports = {
  createSession,
  sendMessage,
  getSession,
  triageOnce,
  MEDICAL_DISCLAIMER,
  PROTOCOL_VERSION,
};
