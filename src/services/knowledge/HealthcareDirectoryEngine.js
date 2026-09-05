/**
 * Healthcare Directory Engine for Medzoos
 * Provides intelligent, real-time doctor, hospital, lab, and pharmacy directory search from PostgreSQL.
 * Ensures only REGISTERED and VERIFIED system providers are listed and recommended with direct action cards.
 */

const prisma = require('../../config/database');

const CITY_SYNONYMS = {
  gujranwala: ['gujranwala', 'grw', 'gujranwala cantt', 'g.t road gujranwala'],
  lahore: ['lahore', 'lhr', 'dha lahore', 'johar town', 'shadman', 'gulberg'],
  karachi: ['karachi', 'khi', 'clifton', 'stadium road', 'defence karachi'],
  islamabad: ['islamabad', 'isb', 'blue area', 'f-8'],
  rawalpindi: ['rawalpindi', 'pindi', 'rwp', 'satellite town'],
  faisalabad: ['faisalabad', 'fsd', 'lyallpur'],
  sialkot: ['sialkot', 'skt'],
  multan: ['multan', 'mux'],
  peshawar: ['peshawar', 'pew'],
};

const SPECIALTY_MAP = {
  diabetes: 'Diabetes',
  diabetologist: 'Diabetes',
  diabetologists: 'Diabetes',
  endocrinology: 'Diabetes',
  endocrinologist: 'Diabetes',
  sugar: 'Diabetes',
  'sugar specialist': 'Diabetes',
  'sugar ke doctor': 'Diabetes',
  cardiology: 'Cardiologist',
  cardiologist: 'Cardiologist',
  cardiologists: 'Cardiologist',
  heart: 'Cardiologist',
  'heart specialist': 'Cardiologist',
  'dil ke doctor': 'Cardiologist',
  psychiatry: 'Psychiatrist',
  psychiatrist: 'Psychiatrist',
  psychiatrists: 'Psychiatrist',
  'mental health': 'Psychiatrist',
  depression: 'Psychiatrist',
  anxiety: 'Psychiatrist',
  'dimagh ke doctor': 'Psychiatrist',
  dermatology: 'Dermatologist',
  dermatologist: 'Dermatologist',
  skin: 'Dermatologist',
  'skin specialist': 'Dermatologist',
  gynecology: 'Gynecologist',
  gynecologist: 'Gynecologist',
  gynaecologist: 'Gynecologist',
  'women specialist': 'Gynecologist',
  pediatrics: 'Pediatrician',
  pediatrician: 'Pediatrician',
  child: 'Pediatrician',
  'child specialist': 'Pediatrician',
  'bachon ke doctor': 'Pediatrician',
  'general physician': 'General Physician',
  physician: 'General Physician',
  internist: 'General Physician',
  'family doctor': 'General Physician',
};

/**
 * Detect if text is asking for doctor, hospital, lab, or pharmacy directory info.
 * @param {string} text
 * @returns {{ isDirectoryQuery: boolean, type: 'hospital_search'|'doctor_search'|'hospital_doctors'|'lab_search'|'pharmacy_search'|null, city: string|null, specialty: string|null, hospitalQuery: string|null }}
 */
function parseDirectoryIntent(text) {
  const normalized = text.toLowerCase().trim();

  const isHospitalAsk =
    /\b(hospital|hospitals|clinic|clinics|medical center|dispensary|haspatal|haspatalon|aspatal)\b/i.test(normalized);
  const isDoctorAsk =
    /\b(doctor|doctors|dr|dr\.|specialist|specialists|physician|physicians|daktar|dactar)\b/i.test(
      normalized,
    );
  const isLabAsk =
    /\b(lab|labs|laboratory|laboratories|diagnostic|blood test|urine test|test list|mri|ct scan|ultrasound|hba1c test|lipid profile|cholesterol test)\b/i.test(
      normalized,
    );
  const isPharmacyAsk =
    /\b(pharmacy|pharmacies|chemist|medical store|dawa|dawain|medicine|medicines|order medicine|prescription delivery|buy medicine)\b/i.test(
      normalized,
    );

  if (!isHospitalAsk && !isDoctorAsk && !isLabAsk && !isPharmacyAsk) {
    return { isDirectoryQuery: false, type: null, city: null, specialty: null, hospitalQuery: null };
  }

  // Detect City
  let matchedCity = null;
  for (const [canonicalCity, synonyms] of Object.entries(CITY_SYNONYMS)) {
    if (synonyms.some((s) => normalized.includes(s))) {
      matchedCity = canonicalCity.charAt(0).toUpperCase() + canonicalCity.slice(1);
      break;
    }
  }

  // Detect Specialty
  let matchedSpecialty = null;
  for (const [kw, canonicalSpecialty] of Object.entries(SPECIALTY_MAP)) {
    if (normalized.includes(kw)) {
      matchedSpecialty = canonicalSpecialty;
      break;
    }
  }

  // Detect specific hospital in query (e.g. "in gulzar hospital", "at shaukat khanum")
  let hospitalQuery = null;
  const hospitalMatch =
    normalized.match(/(?:in|at|of|near)\s+([a-z0-9\s'-]+?\s*(?:hospital|complex|memorial|center|clinic|dhq))/i) ||
    normalized.match(/\b(gulzar|cheema|doctors hospital|shaukat khanum|national hospital|fatima memorial|aga khan|shifa|gondal|citimed|medcare|holy family|dhq)\b/i);

  if (hospitalMatch) {
    hospitalQuery = hospitalMatch[1]
      .replace(/^(?:the|list of|doctors in|doctor in|doctors at|doctor at|share the list of|share list of)\s+/gi, '')
      .trim();
  }

  let queryType = 'doctor_search';
  if (isLabAsk && !isDoctorAsk && !isHospitalAsk) {
    queryType = 'lab_search';
  } else if (isPharmacyAsk && !isDoctorAsk && !isHospitalAsk) {
    queryType = 'pharmacy_search';
  } else if (hospitalQuery && isDoctorAsk) {
    queryType = 'hospital_doctors';
  } else if (isHospitalAsk && !isDoctorAsk) {
    queryType = 'hospital_search';
  } else if (isHospitalAsk && isDoctorAsk) {
    queryType = 'hospital_doctors';
  } else {
    queryType = 'doctor_search';
  }

  return {
    isDirectoryQuery: true,
    type: queryType,
    city: matchedCity,
    specialty: matchedSpecialty,
    hospitalQuery,
  };
}

/**
 * Execute real-time database search for REGISTERED hospitals, doctors, labs, and pharmacies.
 * @param {string} text
 * @returns {Promise<{ found: boolean, type: string, hospitals: Array<object>, doctors: Array<object>, labs: Array<object>, pharmacies: Array<object>, actionCards: Array<object> }>}
 */
async function searchHealthcareDirectory(text) {
  const intent = parseDirectoryIntent(text);
  if (!intent.isDirectoryQuery) {
    return { found: false, type: null, hospitals: [], doctors: [], labs: [], pharmacies: [], actionCards: [] };
  }

  let matchedHospitals = [];
  let matchedDoctors = [];
  let matchedLabs = [];
  let matchedPharmacies = [];

  // 1. Specific Hospital / Hospital Doctors Search
  if (intent.hospitalQuery) {
    const term = intent.hospitalQuery.replace(/\bhospital\b/gi, '').trim();

    matchedHospitals = await prisma.hospital.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: term || intent.hospitalQuery, mode: 'insensitive' } },
          { slug: { contains: term || intent.hospitalQuery, mode: 'insensitive' } },
          { description: { contains: term || intent.hospitalQuery, mode: 'insensitive' } },
        ],
      },
      include: {
        doctors: {
          where: { is_active: true },
          take: 6,
        },
      },
      take: 4,
    });

    if (matchedHospitals.length > 0) {
      const hospitalIds = matchedHospitals.map((h) => h.id);
      const hospitalNames = matchedHospitals.map((h) => h.name);

      matchedDoctors = await prisma.doctor.findMany({
        where: {
          is_active: true,
          OR: [
            { hospital_id: { in: hospitalIds } },
            ...hospitalNames.map((name) => ({ hospital: { contains: name, mode: 'insensitive' } })),
          ],
        },
        include: {
          hospital_ref: true,
        },
        take: 6,
      });
    }
  }

  // 2. City / General Hospitals Search
  if (intent.type === 'hospital_search' || (intent.city && matchedHospitals.length === 0 && intent.type !== 'lab_search' && intent.type !== 'pharmacy_search')) {
    const where = { is_active: true };
    if (intent.city) {
      where.city = { contains: intent.city, mode: 'insensitive' };
    }

    matchedHospitals = await prisma.hospital.findMany({
      where,
      include: {
        doctors: {
          where: { is_active: true },
          take: 3,
        },
      },
      take: 8,
    });

    if (matchedDoctors.length === 0 && matchedHospitals.length > 0) {
      const hospIds = matchedHospitals.map((h) => h.id);
      matchedDoctors = await prisma.doctor.findMany({
        where: {
          is_active: true,
          hospital_id: { in: hospIds },
        },
        include: {
          hospital_ref: true,
        },
        take: 6,
      });
    }
  }

  // 3. Doctors Search (by Specialty or City)
  if (matchedDoctors.length === 0 && (intent.specialty || intent.type === 'doctor_search' || intent.type === 'hospital_search')) {
    const doctorWhere = { is_active: true };

    if (intent.specialty) {
      doctorWhere.specialty = { contains: intent.specialty, mode: 'insensitive' };
    }

    if (intent.city) {
      doctorWhere.OR = [
        { hospital_ref: { city: { contains: intent.city, mode: 'insensitive' } } },
        { hospital: { contains: intent.city, mode: 'insensitive' } },
        { practice_locations: { some: { address: { contains: intent.city, mode: 'insensitive' } } } },
      ];
    }

    matchedDoctors = await prisma.doctor.findMany({
      where: doctorWhere,
      include: {
        hospital_ref: true,
      },
      take: 6,
    });

    // If city filter returned 0 doctors, fallback to all verified specialists in system
    if (matchedDoctors.length === 0 && intent.specialty) {
      matchedDoctors = await prisma.doctor.findMany({
        where: {
          is_active: true,
          specialty: { contains: intent.specialty, mode: 'insensitive' },
        },
        include: {
          hospital_ref: true,
        },
        take: 4,
      });
    }
  }

  // 4. Labs / Diagnostics Search
  if (intent.type === 'lab_search' || text.toLowerCase().includes('lab') || text.toLowerCase().includes('test')) {
    const labWhere = { status: 'approved' };
    if (intent.city) {
      labWhere.city = { contains: intent.city, mode: 'insensitive' };
    }

    matchedLabs = await prisma.labPartner.findMany({
      where: labWhere,
      take: 5,
    });

    if (matchedLabs.length === 0) {
      matchedLabs = await prisma.labPartner.findMany({
        where: { status: 'approved' },
        take: 4,
      });
    }
  }

  // 5. Pharmacies / Vendors Search
  if (intent.type === 'pharmacy_search' || text.toLowerCase().includes('pharmacy') || text.toLowerCase().includes('medicine')) {
    const pharmacyWhere = { status: 'approved' };
    if (intent.city) {
      pharmacyWhere.city = { contains: intent.city, mode: 'insensitive' };
    }

    matchedPharmacies = await prisma.vendor.findMany({
      where: pharmacyWhere,
      take: 5,
    });

    if (matchedPharmacies.length === 0) {
      matchedPharmacies = await prisma.vendor.findMany({
        where: { status: 'approved' },
        take: 4,
      });
    }
  }

  const hasAnyMatch =
    matchedHospitals.length > 0 ||
    matchedDoctors.length > 0 ||
    matchedLabs.length > 0 ||
    matchedPharmacies.length > 0;

  if (!hasAnyMatch) {
    return {
      found: false,
      type: intent.type,
      hospitals: [],
      doctors: [],
      labs: [],
      pharmacies: [],
      actionCards: [],
    };
  }

  // Format interactive action cards for REGISTERED providers only
  const actionCards = [];

  // A. Doctor Action Cards
  for (const doc of matchedDoctors.slice(0, 3)) {
    actionCards.push({
      id: `doc-${doc.id}`,
      type: 'doctor_consultation',
      label: `Book ${doc.name}`,
      reason: `${doc.specialty} • ${doc.hospital || 'Consultant'} • Fee: Rs. ${doc.fee}`,
      priority: 90,
      targetScreen: 'DoctorsList',
      params: { doctorId: doc.id, specialty: doc.specialty },
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: {
          screen: 'DoctorsList',
          params: { specialty: doc.specialty, doctorId: doc.id },
        },
      },
    });
  }

  // B. Hospital Action Cards
  for (const hosp of matchedHospitals.slice(0, 2)) {
    actionCards.push({
      id: `hosp-${hosp.id}`,
      type: 'hospital_info',
      label: `View ${hosp.name}`,
      reason: `${hosp.city || 'Hospital'} • ${hosp.phone || '24/7 Care'}`,
      priority: 85,
      targetScreen: 'HospitalsList',
      params: { hospitalId: hosp.id },
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: {
          screen: 'HospitalsList',
          params: { hospitalId: hosp.id },
        },
      },
    });
  }

  // C. Lab Action Cards
  for (const lab of matchedLabs.slice(0, 2)) {
    actionCards.push({
      id: `lab-${lab.id}`,
      type: 'lab_test',
      label: `Book ${lab.name}`,
      reason: `${lab.city || 'Pakistan'} • ${lab.home_collection ? 'Home Sample Collection' : 'Diagnostic Lab'}`,
      priority: 80,
      targetScreen: 'LabTestsList',
      params: { labId: lab.id },
      navigation: {
        tab: 'Home',
        screen: 'Services',
        params: {
          screen: 'LabTestsList',
          params: { labId: lab.id },
        },
      },
    });
  }

  // D. Pharmacy Action Cards
  for (const pharm of matchedPharmacies.slice(0, 2)) {
    actionCards.push({
      id: `pharm-${pharm.id}`,
      type: 'pharmacy',
      label: `Order from ${pharm.business_name}`,
      reason: `${pharm.city || 'Pakistan'} • ${pharm.delivery_enabled ? 'Home Delivery Available' : 'Verified Pharmacy'}`,
      priority: 75,
      targetScreen: 'MedicinesList',
      params: { vendorId: pharm.id },
      navigation: {
        tab: 'Health',
        screen: 'MedicinesList',
        params: { vendorId: pharm.id },
      },
    });
  }

  return {
    found: true,
    type: intent.type,
    city: intent.city,
    specialty: intent.specialty,
    hospitals: matchedHospitals,
    doctors: matchedDoctors,
    labs: matchedLabs,
    pharmacies: matchedPharmacies,
    actionCards,
  };
}

module.exports = {
  parseDirectoryIntent,
  searchHealthcareDirectory,
};
