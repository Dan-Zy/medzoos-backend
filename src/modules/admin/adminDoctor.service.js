const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');

const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 'Monday', slots: ['09:00 AM - 01:00 PM'] },
  { day: 'Tuesday', slots: ['09:00 AM - 01:00 PM'] },
  { day: 'Wednesday', slots: ['09:00 AM - 01:00 PM'] },
  { day: 'Thursday', slots: ['09:00 AM - 01:00 PM'] },
  { day: 'Friday', slots: ['09:00 AM - 01:00 PM'] },
  { day: 'Saturday', slots: [] },
  { day: 'Sunday', slots: [] },
];

const parseInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseMoney = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapCreateDoctorError = (error) => {
  if (error.code === 'P2002') {
    return new AppError('Email already in use', 400);
  }
  if (error.code === 'P2021' || /does not exist/i.test(error.message || '')) {
    return new AppError(
      'Doctor tables are missing on the server database. Run `npx prisma db push` on production and redeploy.',
      503
    );
  }
  if (error.code === 'P2003') {
    return new AppError('Doctor profile could not be linked to the account', 400);
  }
  return error;
};

const createDoctor = async (payload, adminUserId = null) => {
  const { name, email, password, specialty, experience_years, fee, hospital_id } = payload;

  if (!name?.trim() || !email?.trim() || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  const [existingAccount, legacyDoctor] = await Promise.all([
    prisma.account.findUnique({ where: { email: normalizedEmail } }),
    prisma.doctor.findUnique({ where: { email: normalizedEmail } }),
  ]);

  if (existingAccount || legacyDoctor) {
    throw new AppError('Email already in use', 400);
  }

  let hospitalName = 'Independent Practice';
  let linkedHospitalId = null;

  if (hospital_id) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospital_id } });
    if (!hospital) throw new AppError('Hospital not found', 400);
    hospitalName = hospital.name;
    linkedHospitalId = hospital.id;
  }

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(password, 12);

  let account;
  let doctor;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdAccount = await tx.account.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          role: 'doctor',
        },
      });

      const customSchedule = Array.isArray(payload.days) && payload.days.length > 0
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => ({
            day: d,
            slots: payload.days.includes(d) ? [payload.slots || '09:00 AM - 01:00 PM'] : []
          }))
        : DEFAULT_WEEKLY_SCHEDULE;

      const createdDoctor = await tx.doctor.create({
        data: {
          account_id: createdAccount.id,
          name: normalizedName,
          email: normalizedEmail,
          specialty: specialty?.trim() || 'General Physician',
          experience_years: parseInteger(experience_years, 0),
          fee: parseMoney(fee, 0),
          is_active: true,
          hospital_id: linkedHospitalId,
          hospital: hospitalName,
          languages: [],
          qualifications: [],
          slots: customSchedule,
        },
      });

      if (linkedHospitalId) {
        await tx.doctorPracticeLocation.create({
          data: {
            doctor_id: createdDoctor.id,
            hospital_id: linkedHospitalId,
            fee: parseMoney(fee, 0),
            schedule: customSchedule,
          },
        });
      }

      return { account: createdAccount, doctor: createdDoctor };
    });

    account = result.account;
    doctor = result.doctor;
  } catch (error) {
    throw mapCreateDoctorError(error);
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: 'DOCTOR_CREATED',
        entity: 'doctor',
        entity_id: doctor.id,
        user_id: adminUserId || null,
      },
    });
  } catch {
    // Audit logging should not block doctor creation.
  }

  return {
    ...doctor,
    email: account.email,
  };
};

const updateDoctor = async (id, payload, adminUserId = null) => {
  const cleanId = String(id || '').trim();
  const {
    name,
    email,
    password,
    phone,
    specialty,
    experience_years,
    fee,
    hospital_id,
    photo_url,
    about,
    languages,
    qualifications,
    is_active,
  } = payload;

  const existingDoctor = await prisma.doctor.findFirst({
    where: {
      OR: [
        { id: cleanId },
        { account_id: cleanId },
        { email: { equals: cleanId, mode: 'insensitive' } },
        { name: { equals: cleanId, mode: 'insensitive' } },
      ],
    },
    include: { account: true },
  });

  if (!existingDoctor) {
    throw new AppError('Doctor record not found', 404);
  }

  let hospitalName = undefined;
  let cleanHospitalId = null;

  if (hospital_id && hospital_id !== '' && hospital_id !== 'independent') {
    const hospital = await prisma.hospital.findFirst({
      where: {
        OR: [
          { id: String(hospital_id).trim() },
          { name: { equals: String(hospital_id).trim(), mode: 'insensitive' } },
        ],
      },
    });
    if (hospital) {
      hospitalName = hospital.name;
      cleanHospitalId = hospital.id;
    } else {
      hospitalName = payload.hospital || String(hospital_id).trim();
      cleanHospitalId = null;
    }
  } else if (payload.hospital && payload.hospital !== '' && payload.hospital !== 'Independent Practice') {
    const hospital = await prisma.hospital.findFirst({
      where: {
        name: { equals: String(payload.hospital).trim(), mode: 'insensitive' },
      },
    });
    if (hospital) {
      hospitalName = hospital.name;
      cleanHospitalId = hospital.id;
    } else {
      hospitalName = String(payload.hospital).trim();
      cleanHospitalId = null;
    }
  } else if (hospital_id === null || hospital_id === '' || hospital_id === 'independent' || payload.hospital === 'Independent Practice') {
    hospitalName = 'Independent Practice';
    cleanHospitalId = null;
  }

  const doctorUpdateData = {};
  if (name !== undefined) doctorUpdateData.name = name.trim();
  if (specialty !== undefined) doctorUpdateData.specialty = specialty.trim();
  if (experience_years !== undefined) doctorUpdateData.experience_years = parseInteger(experience_years);
  if (fee !== undefined) doctorUpdateData.fee = parseMoney(fee);
  if (photo_url !== undefined) doctorUpdateData.photo_url = photo_url || null;
  if (phone !== undefined) doctorUpdateData.phone = phone ? phone.trim() : null;
  if (about !== undefined) doctorUpdateData.about = about ? about.trim() : null;
  if (languages !== undefined) doctorUpdateData.languages = Array.isArray(languages) ? languages : [];
  if (qualifications !== undefined) doctorUpdateData.qualifications = Array.isArray(qualifications) ? qualifications : [];
  if (is_active !== undefined) doctorUpdateData.is_active = Boolean(is_active);

  if (hospital_id !== undefined || payload.hospital !== undefined) {
    doctorUpdateData.hospital_id = cleanHospitalId;
    doctorUpdateData.hospital = hospitalName || existingDoctor.hospital || 'Independent Practice';
  }

  const bcrypt = require('bcryptjs');
  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  if (existingDoctor.account_id) {
    const accountUpdateData = {};
    if (normalizedEmail) accountUpdateData.email = normalizedEmail;
    if (password) accountUpdateData.password = await bcrypt.hash(password, 12);

    if (normalizedEmail && normalizedEmail !== existingDoctor.account?.email) {
      const emailTaken = await prisma.account.findUnique({ where: { email: normalizedEmail } });
      if (emailTaken && emailTaken.id !== existingDoctor.account_id) {
        throw new AppError('Email already in use', 400);
      }
    }

    if (Object.keys(accountUpdateData).length > 0) {
      await prisma.account.update({
        where: { id: existingDoctor.account_id },
        data: accountUpdateData,
      });
    }

    if (normalizedEmail) doctorUpdateData.email = normalizedEmail;
  } else {
    if (normalizedEmail) doctorUpdateData.email = normalizedEmail;
    if (password) doctorUpdateData.password = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.doctor.update({
    where: { id: existingDoctor.id },
    data: doctorUpdateData,
    include: { account: { select: { email: true } } },
  });

  try {
    await prisma.auditLog.create({
      data: {
        action: 'DOCTOR_UPDATED',
        entity: 'doctor',
        entity_id: updated.id,
        user_id: adminUserId || null,
      },
    });
  } catch {
    // Ignore audit log error
  }

  return {
    ...updated,
    email: updated.account?.email || updated.email,
  };
};


module.exports = {
  createDoctor,
  updateDoctor,
  DEFAULT_WEEKLY_SCHEDULE,
};
