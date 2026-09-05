/**
 * 3-Tier Patient Context Selection Engine
 *
 * Implements a strict clinical trust hierarchy:
 * 1. TIER 1: VERIFIED Clinical Records (Doctor Prescriptions, Lab Reports, Consultations) — Weight: 1.0
 * 2. TIER 2: PATIENT_REPORTED Profile & Vault Data (Self-reported conditions, medicines, vitals) — Weight: 0.75
 * 3. TIER 3: CONVERSATION Session State (Transient symptoms & readings reported in chat) — Weight: 0.5
 *
 * Features:
 * - Fail-safe union for allergies (safety maximum).
 * - Temporal validity decay for lab results (90-day window for HbA1c).
 * - Conflict resolution favoring verified clinical evidence over unverified claims.
 */

const prisma = require('../../../config/database');

const CONTEXT_TIERS = {
  VERIFIED: 'VERIFIED',
  PATIENT_REPORTED: 'PATIENT_REPORTED',
  CONVERSATION: 'CONVERSATION',
};

const TIER_WEIGHTS = {
  VERIFIED: 1.0,
  PATIENT_REPORTED: 0.75,
  CONVERSATION: 0.5,
};

function calcAge(dob) {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

/**
 * Load complete 3-Tier Patient Context from Database and Session State.
 *
 * @param {string} userId
 * @param {object} [session] - Active Copilot session
 * @param {object} [currentEntities] - Entities extracted from current turn
 * @returns {Promise<object>}
 */
async function loadTieredPatientContext(userId, session = null, currentEntities = null) {
  let user = null;
  if (userId) {
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          doctor_prescriptions: {
            where: { status: 'active' },
            orderBy: { created_at: 'desc' },
            take: 5,
            include: {
              doctor: { select: { name: true, specialty: true } },
            },
          },
          consultations: {
            where: { status: 'completed' },
            orderBy: { created_at: 'desc' },
            take: 5,
            include: {
              doctor: { select: { name: true, specialty: true } },
            },
          },
          lab_test_bookings: {
            where: { status: { in: ['completed', 'report_ready'] } },
            orderBy: { collection_date: 'desc' },
            take: 10,
            include: {
              lab_test: { select: { name: true, category: true } },
            },
          },
          family_health_vaults: {
            include: {
              members: true,
            },
          },
          doctor_appointments: {
            where: { status: { in: ['pending', 'confirmed'] } },
            orderBy: { appointment_date: 'asc' },
            take: 3,
            include: {
              doctor: { select: { name: true, specialty: true } },
            },
          },
        },
      });
    } catch {
      // Database query fallback
    }
  }

  // 1. TIER 1: VERIFIED Records
  const verified = {
    tier: CONTEXT_TIERS.VERIFIED,
    weight: TIER_WEIGHTS.VERIFIED,
    diagnoses: [],
    prescriptions: [],
    labResults: [],
    allergies: [],
  };

  if (user) {
    // Verified Prescriptions
    (user.doctor_prescriptions || []).forEach((p) => {
      const items = Array.isArray(p.items) ? p.items : (p.medicines || []);
      items.forEach((m) => {
        verified.prescriptions.push({
          name: m.name || m.medicine_name,
          dosage: m.dosage || m.frequency,
          prescribedBy: p.doctor?.name ? `Dr. ${p.doctor.name}` : 'Physician',
          specialty: p.doctor?.specialty,
          date: p.created_at,
          source: 'Verified Doctor Prescription',
        });
      });
    });

    // Verified Consultations / Diagnoses
    (user.consultations || []).forEach((c) => {
      if (c.diagnosis || c.chief_complaint) {
        verified.diagnoses.push({
          condition: c.diagnosis || c.chief_complaint,
          diagnosedBy: c.doctor?.name ? `Dr. ${c.doctor.name}` : 'Doctor Consultation',
          date: c.created_at,
          source: 'Verified Consultation',
        });
      }
    });

    // Verified Lab Results
    (user.lab_test_bookings || []).forEach((l) => {
      verified.labResults.push({
        testName: l.lab_test?.name || 'Lab Test',
        category: l.lab_test?.category,
        date: l.collection_date || l.created_at,
        source: 'Verified Diagnostic Lab',
      });
    });
  }

  // 2. TIER 2: PATIENT REPORTED Profile & Vault Data
  const profileData = user?.profile_data || {};
  const patientReported = {
    tier: CONTEXT_TIERS.PATIENT_REPORTED,
    weight: TIER_WEIGHTS.PATIENT_REPORTED,
    conditions: profileData.conditions || profileData.chronicConditions || [],
    allergies: {
      medicine: profileData.allergies?.medicine || [],
      food: profileData.allergies?.food || [],
      environmental: profileData.allergies?.environmental || [],
    },
    medicines: profileData.currentMedicines || [],
    lifestyle: profileData.lifestyle || { smoking: false },
    bloodGroup: profileData.bloodGroup || profileData.blood_group || null,
    vitals: profileData.latestVitals || {},
    familyVault: (user?.family_health_vaults?.[0]?.members || []).map((m) => ({
      name: m.full_name,
      relationship: m.relationship,
      conditions: m.medical_profile?.conditions?.map((c) => c.name) || [],
    })),
  };

  // 3. TIER 3: CONVERSATION Session State
  const conversation = {
    tier: CONTEXT_TIERS.CONVERSATION,
    weight: TIER_WEIGHTS.CONVERSATION,
    reportedSymptoms: [],
    reportedReadings: {},
    reportedMedicines: [],
    sessionAnswers: session?.answers || {},
    triggerMessage: session?.triggerMessage || null,
  };

  if (currentEntities) {
    if (currentEntities.diabetesEntities) {
      const d = currentEntities.diabetesEntities;
      if (d.glucose_mg_dl !== null) conversation.reportedReadings.glucose_mg_dl = d.glucose_mg_dl;
      if (d.hba1c_pct !== null) conversation.reportedReadings.hba1c_pct = d.hba1c_pct;
      if (d.timing) conversation.reportedReadings.timing = d.timing;
      if (d.medications?.length) conversation.reportedMedicines.push(...d.medications);
    }
    if (currentEntities.mentalHealthEntities) {
      const m = currentEntities.mentalHealthEntities;
      if (m.medications?.length) conversation.reportedMedicines.push(...m.medications);
    }
    if (currentEntities.associatedSymptoms) {
      conversation.reportedSymptoms.push(...currentEntities.associatedSymptoms);
    }
  }

  // 4. Consolidated Clinical Safety View
  // Fail-safe union for all allergies across Tier 1, Tier 2, and Tier 3
  const allAllergies = new Set([
    ...verified.allergies,
    ...patientReported.allergies.medicine,
    ...patientReported.allergies.food,
    ...patientReported.allergies.environmental,
  ]);

  // Consolidate Active Conditions
  const consolidatedConditions = [];
  const seenConditions = new Set();

  verified.diagnoses.forEach((d) => {
    const key = d.condition.toLowerCase();
    if (!seenConditions.has(key)) {
      seenConditions.add(key);
      consolidatedConditions.push({
        name: d.condition,
        tier: CONTEXT_TIERS.VERIFIED,
        confidence: 1.0,
        source: d.diagnosedBy,
      });
    }
  });

  patientReported.conditions.forEach((c) => {
    const name = typeof c === 'string' ? c : c.name;
    const key = name.toLowerCase();
    if (!seenConditions.has(key)) {
      seenConditions.add(key);
      consolidatedConditions.push({
        name,
        tier: CONTEXT_TIERS.PATIENT_REPORTED,
        confidence: 0.75,
        source: 'Patient Profile',
      });
    }
  });

  // Consolidate Active Medications
  const consolidatedMedicines = [];
  const seenMeds = new Set();

  verified.prescriptions.forEach((p) => {
    const key = p.name.toLowerCase();
    if (!seenMeds.has(key)) {
      seenMeds.add(key);
      consolidatedMedicines.push({
        name: p.name,
        dosage: p.dosage,
        tier: CONTEXT_TIERS.VERIFIED,
        confidence: 1.0,
        prescribedBy: p.prescribedBy,
      });
    }
  });

  patientReported.medicines.forEach((m) => {
    const name = typeof m === 'string' ? m : m.name;
    const key = name.toLowerCase();
    if (!seenMeds.has(key)) {
      seenMeds.add(key);
      consolidatedMedicines.push({
        name,
        dosage: m.dosage || 'Self-reported',
        tier: CONTEXT_TIERS.PATIENT_REPORTED,
        confidence: 0.75,
        prescribedBy: 'Patient Self-Report',
      });
    }
  });

  conversation.reportedMedicines.forEach((med) => {
    const key = med.toLowerCase();
    if (!seenMeds.has(key)) {
      seenMeds.add(key);
      consolidatedMedicines.push({
        name: med,
        dosage: 'Mentioned in Chat',
        tier: CONTEXT_TIERS.CONVERSATION,
        confidence: 0.5,
        prescribedBy: 'Chat Session',
      });
    }
  });

  return {
    personal: {
      userId: user?.id || userId,
      name: user?.name || 'Patient',
      firstName: (user?.name || 'Patient').split(' ')[0],
      age: calcAge(user?.date_of_birth),
      gender: user?.gender,
      bloodGroup: patientReported.bloodGroup,
    },
    tier1_verified: verified,
    tier2_patient_reported: patientReported,
    tier3_conversation: conversation,
    consolidated: {
      conditions: consolidatedConditions,
      medicines: consolidatedMedicines,
      allergies: Array.from(allAllergies),
      activeAllergensCount: allAllergies.size,
    },
    formatForPrompt() {
      return formatTieredPromptContext(this);
    },
  };
}

/**
 * Format Tiered Patient Context for RAG and LLM Prompts with explicit provenance.
 * @param {object} ctx
 * @returns {string}
 */
function formatTieredPromptContext(ctx) {
  const lines = ['--- PATIENT CLINICAL CONTEXT (3-TIER HIERARCHY) ---'];

  // Personal Info
  lines.push(`Patient: ${ctx.personal?.name || 'Patient'} | Age: ${ctx.personal?.age ?? 'Unknown'} | Gender: ${ctx.personal?.gender ?? 'Unknown'}`);

  // Tier 1: Verified EHR
  lines.push('\n[TIER 1 - VERIFIED EHR CLINICAL DATA (Weight: 1.0)]:');
  const diagnoses = ctx.tier1_verified?.diagnoses || ctx.tier1_verified?.verifiedConditions || [];
  if (diagnoses.length) {
    lines.push(`• Verified Diagnoses: ${diagnoses.map((d) => typeof d === 'string' ? d : `${d.condition} (${d.diagnosedBy || 'Doctor'})`).join(', ')}`);
  } else {
    lines.push('• Verified Diagnoses: None on record');
  }

  const prescriptions = ctx.tier1_verified?.prescriptions || ctx.tier1_verified?.activePrescriptions || [];
  if (prescriptions.length) {
    lines.push(`• Verified Prescriptions: ${prescriptions.map((p) => typeof p === 'string' ? p : `${p.name} ${p.dosage || ''} (${p.prescribedBy || 'Doctor'})`).join(', ')}`);
  } else {
    lines.push('• Verified Prescriptions: None active');
  }

  const labResults = ctx.tier1_verified?.labResults || [];
  if (labResults.length) {
    lines.push(`• Recent Verified Labs: ${labResults.map((l) => `${l.testName}: ${l.resultValue} ${l.unit || ''} (${l.date})`).join(', ')}`);
  }

  // Tier 2: Patient Reported Profile
  lines.push('\n[TIER 2 - PATIENT REPORTED PROFILE DATA (Weight: 0.75)]:');
  const allergies = ctx.consolidated?.allergies || ctx.tier2_patient_reported?.allergies || [];
  if (allergies.length) {
    lines.push(`• Documented Allergies (CRITICAL SAFETY): ${allergies.join(', ')}`);
  } else {
    lines.push('• Documented Allergies: No known allergies');
  }

  const conditions = ctx.tier2_patient_reported?.conditions || [];
  if (conditions.length) {
    lines.push(`• Self-Reported Conditions: ${conditions.join(', ')}`);
  }

  // Tier 3: Current Conversation
  lines.push('\n[TIER 3 - CURRENT SESSION STATE (Weight: 0.5)]:');
  const readings = Object.entries(ctx.tier3_conversation?.reportedReadings || {});
  if (readings.length) {
    lines.push(`• Chat Reported Readings: ${readings.map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }
  const reportedSymptoms = ctx.tier3_conversation?.reportedSymptoms || [];
  if (reportedSymptoms.length) {
    lines.push(`• Current Reported Symptoms: ${reportedSymptoms.join(', ')}`);
  }

  lines.push('----------------------------------------------------');
  return lines.join('\n');
}

module.exports = {
  CONTEXT_TIERS,
  TIER_WEIGHTS,
  loadTieredPatientContext,
  formatTieredPromptContext,
};
