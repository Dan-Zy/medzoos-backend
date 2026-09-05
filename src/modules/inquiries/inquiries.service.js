const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const inboxEvents = require('../notifications/inbox.events');
const bcrypt = require('bcryptjs');

async function processPartnerRegistration(payload, inquiry) {
  if (payload.type !== 'partner' && !payload.metadata?.partner_type) {
    const subjectLower = (payload.subject || '').toLowerCase();
    if (!subjectLower.includes('doctor') && !subjectLower.includes('lab') && !subjectLower.includes('pharmacy')) {
      return;
    }
  }

  const metadata = payload.metadata || {};
  const email = payload.email.trim().toLowerCase();
  const rawName = metadata.full_name || `${payload.first_name} ${payload.last_name}`.trim();
  const phone = payload.phone || metadata.phone || null;
  const subjectLower = (payload.subject || '').toLowerCase();

  const partnerType = metadata.partner_type ||
    (subjectLower.includes('doctor') ? 'doctor' :
     subjectLower.includes('lab') ? 'lab' :
     (subjectLower.includes('pharmacy') || subjectLower.includes('vendor')) ? 'vendor' : 'doctor');

  if (partnerType === 'doctor') {
    try {
      const existingDoctor = await prisma.doctor.findFirst({
        where: { OR: [{ email }, { name: { equals: rawName, mode: 'insensitive' } }] }
      });
      if (!existingDoctor) {
        let account = await prisma.account.findUnique({ where: { email } });
        if (!account) {
          const hashedPassword = await bcrypt.hash('Doctor@12345', 12);
          account = await prisma.account.create({
            data: { email, password: hashedPassword, role: 'doctor', is_active: true }
          });
        }
        const doctorName = rawName.replace(/^Dr\.?\s*/i, '').trim();
        const formattedName = `Dr. ${doctorName || rawName}`;

        const docLinksList = metadata.documents
          ? Object.entries(metadata.documents).map(([k, v]) => `${k}: ${v}`)
          : [];

        const fullQualifications = metadata.qualifications
          ? [metadata.qualifications, ...docLinksList]
          : (docLinksList.length > 0 ? docLinksList : ['MBBS']);

        const fullAbout = [
          metadata.about || '',
          inquiry.message || '',
          metadata.documents ? `DOCUMENTS ATTACHED:\n${Object.entries(metadata.documents).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n');

        await prisma.doctor.create({
          data: {
            account_id: account.id,
            email: email,
            name: formattedName,
            phone: phone,
            specialty: metadata.specialty || 'General Physician',
            experience_years: parseInt(metadata.experience_years || 5, 10),
            fee: parseFloat(metadata.consultation_fee || 1500),
            hospital: metadata.hospital_name || 'Independent Practice',
            about: fullAbout,
            qualifications: fullQualifications,
            languages: ['English', 'Urdu'],
            slots: [
              { day: 'Monday', slots: ['09:00 AM - 01:00 PM', '04:00 PM - 07:00 PM'] },
              { day: 'Tuesday', slots: ['09:00 AM - 01:00 PM'] },
              { day: 'Wednesday', slots: ['09:00 AM - 01:00 PM', '04:00 PM - 07:00 PM'] },
              { day: 'Thursday', slots: ['09:00 AM - 01:00 PM'] },
              { day: 'Friday', slots: ['09:00 AM - 01:00 PM'] }
            ],
            is_active: false,
          }
        });
      }
    } catch (err) {
      console.error('Failed to auto-create Doctor record from partner inquiry:', err.message);
    }
  } else if (partnerType === 'lab') {
    try {
      const existingLab = await prisma.labPartner.findFirst({
        where: { OR: [{ email }, { name: { equals: metadata.facility_name || rawName, mode: 'insensitive' } }] }
      });
      if (!existingLab) {
        let account = await prisma.account.findUnique({ where: { email } });
        if (!account) {
          const hashedPassword = await bcrypt.hash('Lab@12345', 12);
          account = await prisma.account.create({
            data: { email, password: hashedPassword, role: 'lab_partner', is_active: true }
          });
        }
        const fullLabBio = [
          metadata.notes || '',
          inquiry.message || '',
          metadata.documents ? `DOCUMENTS ATTACHED:\n${Object.entries(metadata.documents).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n');

        await prisma.labPartner.create({
          data: {
            account_id: account.id,
            email: email,
            name: metadata.facility_name || rawName,
            phone: phone,
            license_number: metadata.license_number || 'PENDING-VERIFICATION',
            address: metadata.address || '',
            city: metadata.city || 'Gujranwala',
            bio: fullLabBio,
            status: 'pending',
          }
        });
      }
    } catch (err) {
      console.error('Failed to auto-create LabPartner record from partner inquiry:', err.message);
    }
  } else if (partnerType === 'vendor') {
    try {
      const existingVendor = await prisma.vendor.findFirst({
        where: { OR: [{ email }, { business_name: { equals: metadata.business_name || rawName, mode: 'insensitive' } }] }
      });
      if (!existingVendor) {
        let account = await prisma.account.findUnique({ where: { email } });
        if (!account) {
          const hashedPassword = await bcrypt.hash('Vendor@12345', 12);
          account = await prisma.account.create({
            data: { email, password: hashedPassword, role: 'vendor', is_active: true }
          });
        }
        await prisma.vendor.create({
          data: {
            account_id: account.id,
            email: email,
            business_name: metadata.business_name || rawName,
            phone: phone,
            license_number: metadata.license_number || 'PENDING-VERIFICATION',
            address: metadata.address || '',
            city: metadata.city || 'Gujranwala',
            owner_name: rawName,
            status: 'pending',
          }
        });
      }
    } catch (err) {
      console.error('Failed to auto-create Vendor record from partner inquiry:', err.message);
    }
  }
}

async function createInquiry(payload, userId = null) {
  const inquiry = await prisma.contactInquiry.create({
    data: {
      first_name: payload.first_name.trim(),
      last_name: (payload.last_name || '').trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone || null,
      type: payload.type || 'general',
      subject: payload.subject || '',
      message: payload.message.trim(),
      user_id: userId || null,
    },
  });

  await processPartnerRegistration(payload, inquiry);
  await inboxEvents.contactInquiry(inquiry);
  return inquiry;
}

async function listInquiries() {
  return prisma.contactInquiry.findMany({
    orderBy: { created_at: 'desc' },
    take: 200,
  });
}

async function updateInquiry(id, { status }) {
  const existing = await prisma.contactInquiry.findUnique({ where: { id } });
  if (!existing) throw new AppError('Inquiry not found', 404);

  return prisma.contactInquiry.update({
    where: { id },
    data: status ? { status } : {},
  });
}

module.exports = {
  createInquiry,
  listInquiries,
  updateInquiry,
};
