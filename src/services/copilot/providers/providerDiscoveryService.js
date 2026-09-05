/**
 * Live provider discovery — database is source of truth.
 * LLM must never invent providers.
 */

const prisma = require('../../../config/database');
const { normalizeSpecialty } = require('../protocols/specialtyMapping');

/**
 * @param {object} params
 * @param {string} [params.specialty]
 * @param {boolean} [params.onlineOnly]
 * @param {number} [params.limit]
 */
async function findDoctors(params = {}) {
  const specialty = normalizeSpecialty(params.specialty) || params.specialty;
  const where = { is_active: true };
  if (specialty) where.specialty = specialty;
  if (params.onlineOnly) where.online = true;

  try {
    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: [{ rating: 'desc' }, { experience_years: 'desc' }],
      take: params.limit || 5,
      select: {
        id: true,
        name: true,
        specialty: true,
        fee: true,
        rating: true,
        online: true,
        available_today: true,
        hospital: true,
        photo_url: true,
      },
    });

    return doctors.map((d) => ({
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      fee: d.fee,
      rating: d.rating,
      online: d.online,
      availableToday: d.available_today,
      hospital: d.hospital,
      photoUrl: d.photo_url,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * @param {object} params
 * @param {string} [params.testSlug]
 * @param {string} [params.city]
 * @param {number} [params.limit]
 */
async function findLabs(params = {}) {
  try {
    const where = { status: 'approved' };
    if (params.city) {
      where.city = { contains: params.city, mode: 'insensitive' };
    }

    const labs = await prisma.labPartner.findMany({
      where,
      take: params.limit || 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        city: true,
        home_collection: true,
        status: true,
      },
    });

    let tests = [];
    if (params.testSlug) {
      const q = String(params.testSlug).replace(/_/g, ' ');
      tests = await prisma.labTest.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          lab_partner_id: true,
        },
      });
    }

    return {
      labs: labs.map((l) => ({
        id: l.id,
        name: l.name,
        city: l.city,
        homeCollection: l.home_collection,
      })),
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        category: t.category,
        labPartnerId: t.lab_partner_id,
      })),
    };
  } catch {
    return { labs: [], tests: [] };
  }
}

/**
 * @param {object} params
 * @param {string} [params.city]
 * @param {number} [params.limit]
 */
async function findPharmacies(params = {}) {
  try {
    const where = {
      status: { in: ['active', 'approved'] },
      is_online: true,
    };
    if (params.city) {
      where.city = { contains: params.city, mode: 'insensitive' };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      take: params.limit || 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        business_name: true,
        city: true,
        status: true,
        slug: true,
        is_open: true,
      },
    });

    return vendors.map((v) => ({
      id: v.id,
      name: v.business_name,
      city: v.city,
      status: v.status,
      slug: v.slug,
      isOpen: v.is_open,
    }));
  } catch {
    try {
      const vendors = await prisma.vendor.findMany({
        where: { status: 'approved' },
        take: params.limit || 5,
        select: {
          id: true,
          business_name: true,
          city: true,
          status: true,
          slug: true,
        },
      });
      return vendors.map((v) => ({
        id: v.id,
        name: v.business_name,
        city: v.city,
        status: v.status,
        slug: v.slug,
      }));
    } catch {
      return [];
    }
  }
}

/**
 * @param {object} params
 * @param {'doctor'|'lab'|'pharmacy'} params.type
 */
async function discoverProviders(params) {
  if (params.type === 'doctor') {
    const doctors = await findDoctors(params);
    return { type: 'doctor', results: doctors };
  }
  if (params.type === 'lab') {
    const data = await findLabs(params);
    return { type: 'lab', results: data };
  }
  if (params.type === 'pharmacy') {
    const pharmacies = await findPharmacies(params);
    return { type: 'pharmacy', results: pharmacies };
  }
  return { type: params.type, results: [] };
}

module.exports = {
  findDoctors,
  findLabs,
  findPharmacies,
  discoverProviders,
};
