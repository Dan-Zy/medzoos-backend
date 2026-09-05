const crypto = require('crypto');
const prisma = require('../../../config/database');
const AppError = require('../../../utils/AppError');
const { getRefreshExpiryDate } = require('./jwt.service');

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

async function createSession(userId, refreshToken, { deviceId, platform }) {
  const hashed = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshExpiryDate();

  return prisma.userSession.create({
    data: {
      user_id: userId,
      device_id: deviceId || 'unknown',
      platform: platform || 'web',
      refresh_token: hashed,
      expires_at: expiresAt,
    },
  });
}

async function findSessionByRefreshToken(refreshToken) {
  const hashed = hashRefreshToken(refreshToken);
  const session = await prisma.userSession.findUnique({
    where: { refresh_token: hashed },
    include: { user: { include: { account: true } } },
  });

  if (!session) return null;
  if (session.expires_at < new Date()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session;
}

async function rotateSession(sessionId, userId, newRefreshToken, meta) {
  await prisma.userSession.delete({ where: { id: sessionId } }).catch(() => {});
  return createSession(userId, newRefreshToken, meta);
}

async function revokeSession(refreshToken) {
  const hashed = hashRefreshToken(refreshToken);
  await prisma.userSession.deleteMany({ where: { refresh_token: hashed } });
}

async function revokeAllSessions(userId) {
  await prisma.userSession.deleteMany({ where: { user_id: userId } });
}

async function revokeSessionById(sessionId, userId) {
  const session = await prisma.userSession.findFirst({
    where: { id: sessionId, user_id: userId },
  });
  if (!session) throw new AppError('Session not found', 404);
  await prisma.userSession.delete({ where: { id: sessionId } });
}

async function getUserSessions(userId, currentRefreshToken) {
  const hashedCurrent = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null;
  const sessions = await prisma.userSession.findMany({
    where: {
      user_id: userId,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceId: s.device_id,
    platform: s.platform,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    isCurrent: hashedCurrent ? s.refresh_token === hashedCurrent : false,
  }));
}

async function revokeOtherSessions(userId, currentRefreshToken) {
  if (currentRefreshToken) {
    const hashed = hashRefreshToken(currentRefreshToken);
    return prisma.userSession.deleteMany({
      where: {
        user_id: userId,
        refresh_token: { not: hashed },
      },
    });
  }
  return prisma.userSession.deleteMany({
    where: { user_id: userId },
  });
}

module.exports = {
  hashRefreshToken,
  createSession,
  findSessionByRefreshToken,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  revokeSessionById,
  getUserSessions,
  revokeOtherSessions,
};
