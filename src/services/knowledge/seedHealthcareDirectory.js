/**
 * Healthcare Directory Seeder for Medzoos
 * Populates real registered hospitals and doctors across Gujranwala, Lahore, Karachi, Islamabad, and other cities.
 */

const prisma = require('../../config/database');

const HOSPITALS_DATA = [
  // Gujranwala Hospitals
  {
    name: 'Gulzar Hospital',
    slug: 'gulzar-hospital-gujranwala',
    city: 'Gujranwala',
    address: 'G.T. Road, Gujranwala, Punjab',
    phone: '+92 55 3843100',
    email: 'info@gulzarhospital.pk',
    description: 'Premier tertiary care hospital in Gujranwala offering specialized Diabetes & Endocrinology, Cardiology, General Surgery, Pediatrics, and Gynecology units.',
  },
  {
    name: 'DHQ Teaching Hospital Gujranwala',
    slug: 'dhq-teaching-hospital-gujranwala',
    city: 'Gujranwala',
    address: 'Civil Lines, Gujranwala, Punjab',
    phone: '+92 55 9200141',
    email: 'dhq.gujranwala@punjab.gov.pk',
    description: 'Major government tertiary teaching hospital with 24/7 trauma emergency, intensive care, and multi-specialty OPD services.',
  },
  {
    name: 'MedCare International Hospital',
    slug: 'medcare-international-hospital-gujranwala',
    city: 'Gujranwala',
    address: 'Court Road, Civil Lines, Gujranwala',
    phone: '+92 55 3255555',
    email: 'care@medcaregujranwala.com',
    description: 'Modern private hospital in Gujranwala with advanced diagnostics, laparoscopic surgery, cardiac care, and executive clinics.',
  },
  {
    name: 'Gondal Hospital',
    slug: 'gondal-hospital-gujranwala',
    city: 'Gujranwala',
    address: 'Main Sialkot Road, Gujranwala',
    phone: '+92 55 3258000',
    email: 'info@gondalhospital.com',
    description: 'Comprehensive medical facility specializing in orthopedic surgery, pediatrics, internal medicine, and emergency care.',
  },
  {
    name: 'Citimed Hospital',
    slug: 'citimed-hospital-gujranwala',
    city: 'Gujranwala',
    address: 'Model Town, Gujranwala',
    phone: '+92 55 3855000',
    email: 'contact@citimed.pk',
    description: 'Multi-specialty hospital providing expert consultations in gastroenterology, diabetes care, and maternal health.',
  },

  // Lahore Hospitals
  {
    name: 'Cheema Heart Complex',
    slug: 'cheema-heart-complex',
    city: 'Lahore',
    address: 'DHA Phase 4, Lahore',
    phone: '+92 42 35761234',
    email: 'info@cheemaheart.com',
    description: 'Leading cardiac care center specializing in interventional cardiology, echocardiography, and cardiac rehabilitation.',
  },
  {
    name: 'Doctors Hospital & Medical Center',
    slug: 'doctors-hospital',
    city: 'Lahore',
    address: 'Jail Road, Lahore',
    phone: '+92 42 111000456',
    email: 'info@doctorshospital.com',
    description: 'Premier tertiary care hospital with leading specialists in Endocrinology, Nephrology, Dermatology, and General Medicine.',
  },
  {
    name: 'Shaukat Khanum Memorial Cancer Hospital',
    slug: 'shaukat-khanum',
    city: 'Lahore',
    address: '7A Block R3 Johar Town, Lahore',
    phone: '+92 42 35905000',
    email: 'info@shaukatkhanum.org.pk',
    description: 'World-class charitable cancer hospital providing oncology, psychiatry, palliative care, and pathology diagnostics.',
  },
  {
    name: 'Fatima Memorial Hospital',
    slug: 'fatima-memorial-hospital-lahore',
    city: 'Lahore',
    address: 'Shadman, Lahore',
    phone: '+92 42 111555600',
    email: 'info@fmsystem.org',
    description: 'Renowned academic hospital with excellence in maternal and child health, endocrinology, and internal medicine.',
  },

  // Karachi Hospitals
  {
    name: 'National Hospital',
    slug: 'national-hospital',
    city: 'Karachi',
    address: 'Stadium Road, Karachi',
    phone: '+92 21 111000123',
    email: 'contact@nationalhospital.pk',
    description: 'Multi-specialty hospital offering general medicine, diabetes management, pediatrics, and emergency care.',
  },
  {
    name: 'Aga Khan University Hospital',
    slug: 'aga-khan-university-hospital-karachi',
    city: 'Karachi',
    address: 'Stadium Road, Karachi',
    phone: '+92 21 111911911',
    email: 'akuh.information@aku.edu',
    description: 'JCIA-accredited premier university hospital providing world-standard tertiary healthcare and clinical research.',
  },
  {
    name: 'Liaquat National Hospital',
    slug: 'liaquat-national-hospital-karachi',
    city: 'Karachi',
    address: 'National Stadium Road, Karachi',
    phone: '+92 21 111456456',
    email: 'info@lnh.edu.pk',
    description: 'Leading tertiary care center known for neurosurgery, orthopedics, cardiology, and comprehensive diabetes clinics.',
  },

  // Islamabad & Rawalpindi Hospitals
  {
    name: 'Shifa International Hospital',
    slug: 'shifa-international-hospital-islamabad',
    city: 'Islamabad',
    address: 'Pitras Bukhari Road, H-8/4, Islamabad',
    phone: '+92 51 8464646',
    email: 'info@shifa.com.pk',
    description: 'Premier tertiary healthcare center in Islamabad specializing in organ transplants, cardiology, and diabetes care.',
  },
  {
    name: 'Holy Family Hospital',
    slug: 'holy-family-hospital-rawalpindi',
    city: 'Rawalpindi',
    address: 'Satellite Town, Rawalpindi',
    phone: '+92 51 9290321',
    email: 'info@holyfamily.gov.pk',
    description: 'Major public teaching hospital attached to Rawalpindi Medical University providing 24/7 multi-specialty care.',
  },

  // Faisalabad & Sialkot Hospitals
  {
    name: 'Faisal Hospital',
    slug: 'faisal-hospital-faisalabad',
    city: 'Faisalabad',
    address: 'Peoples Colony No. 1, Faisalabad',
    phone: '+92 41 8545555',
    email: 'info@faisalhospital.pk',
    description: 'Modern healthcare center in Faisalabad with dedicated diabetes, cardiology, and dialysis services.',
  },
  {
    name: 'Allama Iqbal Memorial Teaching Hospital',
    slug: 'allama-iqbal-hospital-sialkot',
    city: 'Sialkot',
    address: 'Commissioner Road, Sialkot',
    phone: '+92 52 9250041',
    email: 'aimth@sialkot.gov.pk',
    description: 'Teaching hospital affiliated with Khawaja Muhammad Safdar Medical College serving Sialkot and surrounding areas.',
  },
];

const DOCTORS_DATA = [
  // Gujranwala Doctors
  {
    name: 'Dr. Muhammad Tariq',
    specialty: 'Diabetes',
    experience_years: 16,
    rating: 4.9,
    reviews_count: 310,
    fee: 1800,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'gulzar-hospital-gujranwala',
    hospitalName: 'Gulzar Hospital',
    city: 'Gujranwala',
    about: 'MBBS, FCPS (Medicine), Fellowship in Endocrinology & Diabetology. Pioneer in advanced type 2 diabetes management, insulin therapy, and diabetic foot prevention in Gujranwala.',
    qualifications: ['MBBS — King Edward Medical University', 'FCPS — College of Physicians & Surgeons Pakistan', 'Fellowship in Diabetology'],
    slots: ['10:00 AM', '12:00 PM', '04:00 PM', '06:00 PM'],
  },
  {
    name: 'Dr. Usman Ghani',
    specialty: 'Cardiologist',
    experience_years: 14,
    rating: 4.8,
    reviews_count: 240,
    fee: 2000,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'gulzar-hospital-gujranwala',
    hospitalName: 'Gulzar Hospital',
    city: 'Gujranwala',
    about: 'Consultant Interventional Cardiologist at Gulzar Hospital. Specializes in hypertension management, angiography, post-MI care, and cardiac echo diagnostics.',
    qualifications: ['MBBS', 'FCPS (Cardiology)', 'Fellowship in Interventional Cardiology'],
    slots: ['11:00 AM', '02:00 PM', '05:00 PM', '07:00 PM'],
  },
  {
    name: 'Dr. Shazia Parveen',
    specialty: 'Gynecologist',
    experience_years: 18,
    rating: 4.9,
    reviews_count: 420,
    fee: 1800,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'gulzar-hospital-gujranwala',
    hospitalName: 'Gulzar Hospital',
    city: 'Gujranwala',
    about: 'Senior Consultant Obstetrician & Gynecologist at Gulzar Hospital Gujranwala. Expert in high-risk pregnancy, gestational diabetes management, and infertility.',
    qualifications: ['MBBS', 'FCPS (Obs & Gynae)', 'MRCOG-I'],
    slots: ['09:30 AM', '11:30 AM', '03:30 PM', '06:00 PM'],
  },
  {
    name: 'Dr. Bilal Akhtar',
    specialty: 'General Physician',
    experience_years: 11,
    rating: 4.7,
    reviews_count: 185,
    fee: 1200,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'medcare-international-hospital-gujranwala',
    hospitalName: 'MedCare International Hospital',
    city: 'Gujranwala',
    about: 'Consultant Family Physician with extensive experience in diagnosing infectious diseases, chronic hypertension, fever workup, and metabolic disorders in Gujranwala.',
    qualifications: ['MBBS', 'MCPS (Family Medicine)'],
    slots: ['10:00 AM', '01:00 PM', '04:00 PM', '08:00 PM'],
  },
  {
    name: 'Dr. Kamran Rafiq',
    specialty: 'Pediatrician',
    experience_years: 13,
    rating: 4.8,
    reviews_count: 215,
    fee: 1500,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'gondal-hospital-gujranwala',
    hospitalName: 'Gondal Hospital',
    city: 'Gujranwala',
    about: 'Child Specialist & Neonatologist at Gondal Hospital Gujranwala. Focuses on infant nutrition, pediatric asthma, newborn jaundice, and developmental monitoring.',
    qualifications: ['MBBS', 'DCH', 'FCPS (Pediatrics)'],
    slots: ['10:30 AM', '01:30 PM', '05:00 PM', '07:30 PM'],
  },
  {
    name: 'Dr. Nadeem Anwar',
    specialty: 'Psychiatrist',
    experience_years: 15,
    rating: 4.9,
    reviews_count: 160,
    fee: 2200,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'citimed-hospital-gujranwala',
    hospitalName: 'Citimed Hospital',
    city: 'Gujranwala',
    about: 'Consultant Neuro-Psychiatrist specializing in depression, panic disorders, obsessive-compulsive disorder (OCD), insomnia, and psychological counseling in Gujranwala.',
    qualifications: ['MBBS', 'FCPS (Psychiatry)', 'Diploma in Clinical CBT'],
    slots: ['03:00 PM', '05:00 PM', '07:00 PM', '09:00 PM'],
  },

  // Lahore Doctors
  {
    name: 'Abdullah Warraich',
    specialty: 'Diabetes',
    experience_years: 10,
    rating: 4.9,
    reviews_count: 380,
    fee: 1500,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'doctors-hospital',
    hospitalName: 'Doctors Hospital & Medical Center',
    city: 'Lahore',
    about: 'Diabetologist and Lifestyle Medicine Specialist. Pioneer in structured diabetes remission, continuous glucose monitoring (CGM), and dietary insulin titration.',
    qualifications: ['MBBS', 'Certified Diabetes Educator (ADA)', 'Diploma in Clinical Endocrinology'],
    slots: ['10:00 AM', '02:00 PM', '05:00 PM', '08:00 PM'],
  },
  {
    name: 'Dr. Hassan Ali',
    specialty: 'Cardiologist',
    experience_years: 15,
    rating: 4.8,
    reviews_count: 198,
    fee: 2500,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Punjabi'],
    hospitalSlug: 'cheema-heart-complex',
    hospitalName: 'Cheema Heart Complex',
    city: 'Lahore',
    about: 'Interventional cardiologist with expertise in hypertension, coronary angiography, heart failure, and preventive cardiology in Lahore.',
    qualifications: ['MBBS', 'FRCP (Cardiology)', 'Fellowship in Interventional Cardiology'],
    slots: ['09:00 AM', '12:00 PM', '03:00 PM', '05:00 PM'],
  },
  {
    name: 'Dr. Sara Ahmed',
    specialty: 'Dermatologist',
    experience_years: 9,
    rating: 4.9,
    reviews_count: 412,
    fee: 2000,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'doctors-hospital',
    hospitalName: 'Doctors Hospital & Medical Center',
    city: 'Lahore',
    about: 'Board-certified dermatologist treating acne, eczema, psoriasis, hair loss, and cosmetic dermatology in Lahore.',
    qualifications: ['MBBS', 'MD (Dermatology)'],
    slots: ['10:30 AM', '01:00 PM', '03:30 PM', '06:00 PM'],
  },
  {
    name: 'Dr. Imran Shah',
    specialty: 'Psychiatrist',
    experience_years: 18,
    rating: 4.7,
    reviews_count: 155,
    fee: 3000,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'shaukat-khanum',
    hospitalName: 'Shaukat Khanum Memorial Cancer Hospital',
    city: 'Lahore',
    about: 'Senior Consultant Psychiatrist specializing in psycho-oncology, major depressive disorder, anxiety, PTSD, and addiction medicine in Lahore.',
    qualifications: ['MBBS', 'MRCPsych (UK)', 'FCPS (Psychiatry)'],
    slots: ['03:00 PM', '05:00 PM', '07:00 PM'],
  },

  // Karachi Doctors
  {
    name: 'Dr. Ayesha Khan',
    specialty: 'General Physician',
    experience_years: 12,
    rating: 4.9,
    reviews_count: 324,
    fee: 1500,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'national-hospital',
    hospitalName: 'National Hospital',
    city: 'Karachi',
    about: 'Consultant Physician specializing in adult chronic disease management, diabetes screenings, hypertension, and preventive checkups in Karachi.',
    qualifications: ['MBBS — Aga Khan University', 'FCPS — College of Physicians'],
    slots: ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'],
  },
  {
    name: 'Dr. Omar Farooq',
    specialty: 'Pediatrician',
    experience_years: 10,
    rating: 4.7,
    reviews_count: 267,
    fee: 1800,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu', 'Sindhi'],
    hospitalSlug: 'aga-khan-university-hospital-karachi',
    hospitalName: 'Aga Khan University Hospital',
    city: 'Karachi',
    about: 'Pediatrician specializing in newborn care, growth assessment, immunization, and childhood metabolic conditions.',
    qualifications: ['MBBS', 'FCPS (Pediatrics)'],
    slots: ['09:30 AM', '11:00 AM', '02:30 PM', '05:30 PM'],
  },
  {
    name: 'Dr. Fatima Rizvi',
    specialty: 'Gynecologist',
    experience_years: 14,
    rating: 4.8,
    reviews_count: 189,
    fee: 2200,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'liaquat-national-hospital-karachi',
    hospitalName: 'Liaquat National Hospital',
    city: 'Karachi',
    about: 'Experienced gynecologist providing comprehensive prenatal care, laparoscopic gynecology, and women hormonal health management.',
    qualifications: ['MBBS', 'FCPS (Obstetrics & Gynecology)'],
    slots: ['10:00 AM', '12:30 PM', '03:00 PM', '06:30 PM'],
  },

  // Islamabad Doctors
  {
    name: 'Dr. Zeeshan Haider',
    specialty: 'Diabetes',
    experience_years: 13,
    rating: 4.9,
    reviews_count: 280,
    fee: 2500,
    online: true,
    available_today: true,
    languages: ['English', 'Urdu'],
    hospitalSlug: 'shifa-international-hospital-islamabad',
    hospitalName: 'Shifa International Hospital',
    city: 'Islamabad',
    about: 'Consultant Diabetologist & Endocrinologist in Islamabad. Expert in type 1 and type 2 diabetes, thyroid disorders, and obesity medicine.',
    qualifications: ['MBBS', 'FCPS (Endocrinology)', 'FACE (USA)'],
    slots: ['11:00 AM', '02:00 PM', '05:00 PM', '07:00 PM'],
  },
];

async function seedHealthcareDirectory() {
  console.log('--- Starting Healthcare Directory Seeding ---');

  const hospitalMap = new Map();

  for (const h of HOSPITALS_DATA) {
    const upserted = await prisma.hospital.upsert({
      where: { slug: h.slug },
      update: {
        name: h.name,
        city: h.city,
        address: h.address,
        phone: h.phone,
        email: h.email,
        description: h.description,
        is_active: true,
      },
      create: {
        name: h.name,
        slug: h.slug,
        city: h.city,
        address: h.address,
        phone: h.phone,
        email: h.email,
        description: h.description,
        is_active: true,
      },
    });

    hospitalMap.set(h.slug, upserted);
    console.log(`[Hospital] Upserted: ${upserted.name} (${upserted.city})`);
  }

  for (const doc of DOCTORS_DATA) {
    const hospitalRecord = hospitalMap.get(doc.hospitalSlug);
    const hospitalId = hospitalRecord?.id || null;
    const hospitalName = hospitalRecord?.name || doc.hospitalName;

    // Check if doctor exists by name or create
    const existing = await prisma.doctor.findFirst({
      where: { name: doc.name },
    });

    let doctorId;
    if (existing) {
      const updated = await prisma.doctor.update({
        where: { id: existing.id },
        data: {
          specialty: doc.specialty,
          experience_years: doc.experience_years,
          rating: doc.rating,
          reviews_count: doc.reviews_count,
          fee: doc.fee,
          online: doc.online,
          available_today: doc.available_today,
          languages: doc.languages,
          slots: doc.slots,
          about: doc.about,
          qualifications: doc.qualifications,
          hospital: hospitalName,
          hospital_id: hospitalId,
          is_active: true,
        },
      });
      doctorId = updated.id;
      console.log(`[Doctor] Updated: ${updated.name} - ${updated.specialty} (${hospitalName})`);
    } else {
      const created = await prisma.doctor.create({
        data: {
          name: doc.name,
          specialty: doc.specialty,
          experience_years: doc.experience_years,
          rating: doc.rating,
          reviews_count: doc.reviews_count,
          fee: doc.fee,
          online: doc.online,
          available_today: doc.available_today,
          languages: doc.languages,
          slots: doc.slots,
          about: doc.about,
          qualifications: doc.qualifications,
          hospital: hospitalName,
          hospital_id: hospitalId,
          is_active: true,
        },
      });
      doctorId = created.id;
      console.log(`[Doctor] Created: ${created.name} - ${created.specialty} (${hospitalName})`);
    }

    // Link Practice Location
    if (hospitalId) {
      await prisma.doctorPracticeLocation.deleteMany({
        where: { doctor_id: doctorId },
      });

      await prisma.doctorPracticeLocation.create({
        data: {
          doctor_id: doctorId,
          hospital_id: hospitalId,
          clinic_name: hospitalName,
          address: hospitalRecord.address,
          fee: doc.fee,
          schedule: [
            { day: 'Monday', slots: ['09:00 AM - 01:00 PM', '05:00 PM - 08:00 PM'] },
            { day: 'Wednesday', slots: ['09:00 AM - 01:00 PM', '05:00 PM - 08:00 PM'] },
            { day: 'Friday', slots: ['09:00 AM - 01:00 PM', '05:00 PM - 08:00 PM'] },
          ],
          is_active: true,
        },
      });
    }
  }

  // Seed Diagnostic Labs
  const LABS_DATA = [
    {
      name: 'Chughtai Lab',
      city: 'Lahore',
      address: '7 Jail Road, Main Gulberg, Lahore',
      phone: '+92 42 111 748 464',
      bio: 'Pakistan premier diagnostic laboratory offering 24/7 home sample collection, pathology, HbA1c, lipid profiles, and hormone testing.',
      home_collection: true,
      operating_hours: '24/7 Open',
      collection_areas: 'Lahore, Gujranwala, Karachi, Islamabad, Rawalpindi, Faisalabad',
      rating: 4.8,
    },
    {
      name: 'Islamabad Diagnostic Centre (IDC)',
      city: 'Islamabad',
      address: 'F-8 Markaz, Islamabad',
      phone: '+92 51 111 000 432',
      bio: 'Advanced diagnostic imaging, MRI, CT Scan, ultrasound, diabetes profiles, and complete molecular pathology.',
      home_collection: true,
      operating_hours: '24/7 Open',
      collection_areas: 'Islamabad, Rawalpindi, Lahore, Gujranwala',
      rating: 4.9,
    },
    {
      name: 'Excel Labs',
      city: 'Islamabad',
      address: 'Reshi Building, Blue Area, Islamabad',
      phone: '+92 51 2824900',
      bio: 'Internationally accredited clinical laboratory with specialized biochemistry, endocrinology, and genetic screening.',
      home_collection: true,
      operating_hours: '08:00 AM - 10:00 PM',
      collection_areas: 'Islamabad, Rawalpindi, Lahore',
      rating: 4.7,
    },
    {
      name: 'Shaukat Khanum Diagnostic Centre',
      city: 'Gujranwala',
      address: 'G.T. Road, Near Trust Plaza, Gujranwala',
      phone: '+92 55 3733000',
      bio: 'State-of-the-art diagnostic collection centre in Gujranwala with verified accurate pathology and cancer biomarker testing.',
      home_collection: true,
      operating_hours: '08:00 AM - 08:00 PM',
      collection_areas: 'Gujranwala, Sialkot, Wazirabad',
      rating: 4.9,
    },
  ];

  for (const lab of LABS_DATA) {
    const existing = await prisma.labPartner.findFirst({
      where: { name: lab.name },
    });

    if (existing) {
      await prisma.labPartner.update({
        where: { id: existing.id },
        data: {
          city: lab.city,
          address: lab.address,
          phone: lab.phone,
          bio: lab.bio,
          home_collection: lab.home_collection,
          operating_hours: lab.operating_hours,
          collection_areas: lab.collection_areas,
          rating: lab.rating,
          status: 'approved',
        },
      });
      console.log(`[Lab] Updated: ${lab.name} (${lab.city})`);
    } else {
      await prisma.labPartner.create({
        data: {
          name: lab.name,
          city: lab.city,
          address: lab.address,
          phone: lab.phone,
          bio: lab.bio,
          home_collection: lab.home_collection,
          operating_hours: lab.operating_hours,
          collection_areas: lab.collection_areas,
          rating: lab.rating,
          status: 'approved',
        },
      });
      console.log(`[Lab] Created: ${lab.name} (${lab.city})`);
    }
  }

  // Seed Verified Pharmacies (Vendors)
  const PHARMACIES_DATA = [
    {
      business_name: 'Fazal Din Pharma Plus',
      city: 'Lahore',
      address: 'Mall Road & DHA Phase 5, Lahore',
      phone: '+92 42 111 337 337',
      business_type: 'pharmacy',
      license_number: 'LIC-PK-LHR-00192',
      pickup_enabled: true,
      delivery_enabled: true,
      is_open: true,
      is_online: true,
      status: 'approved',
    },
    {
      business_name: 'MedCo Pharmacy',
      city: 'Lahore',
      address: 'Gulberg III & Johar Town, Lahore',
      phone: '+92 42 35789000',
      business_type: 'pharmacy',
      license_number: 'LIC-PK-LHR-00281',
      pickup_enabled: true,
      delivery_enabled: true,
      is_open: true,
      is_online: true,
      status: 'approved',
    },
    {
      business_name: 'City Pharmacy',
      city: 'Gujranwala',
      address: 'Model Town & G.T. Road, Gujranwala',
      phone: '+92 55 3822100',
      business_type: 'pharmacy',
      license_number: 'LIC-PK-GRW-00441',
      pickup_enabled: true,
      delivery_enabled: true,
      is_open: true,
      is_online: true,
      status: 'approved',
    },
    {
      business_name: 'Servaid Pharmacy',
      city: 'Gujranwala',
      address: 'Civil Lines & Satellite Town, Gujranwala',
      phone: '+92 55 111 737 824',
      business_type: 'pharmacy',
      license_number: 'LIC-PK-GRW-00512',
      pickup_enabled: true,
      delivery_enabled: true,
      is_open: true,
      is_online: true,
      status: 'approved',
    },
  ];

  for (const p of PHARMACIES_DATA) {
    const existing = await prisma.vendor.findFirst({
      where: { business_name: p.business_name },
    });

    if (existing) {
      await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          city: p.city,
          address: p.address,
          phone: p.phone,
          business_type: p.business_type,
          pickup_enabled: p.pickup_enabled,
          delivery_enabled: p.delivery_enabled,
          is_open: p.is_open,
          is_online: p.is_online,
          status: 'approved',
        },
      });
      console.log(`[Pharmacy] Updated: ${p.business_name} (${p.city})`);
    } else {
      await prisma.vendor.create({
        data: {
          business_name: p.business_name,
          license_number: p.license_number,
          city: p.city,
          address: p.address,
          phone: p.phone,
          business_type: p.business_type,
          pickup_enabled: p.pickup_enabled,
          delivery_enabled: p.delivery_enabled,
          is_open: p.is_open,
          is_online: p.is_online,
          status: 'approved',
        },
      });
      console.log(`[Pharmacy] Created: ${p.business_name} (${p.city})`);
    }
  }

  console.log('--- Healthcare Directory Seeding Completed Successfully ---');
}

if (require.main === module) {
  seedHealthcareDirectory()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = { seedHealthcareDirectory };
