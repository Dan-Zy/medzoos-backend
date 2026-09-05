const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const { hashPassword, comparePassword } = require('../auth/auth.helper');

const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      addresses: true,
      profile_data: true,
      notification_preferences: true,
      created_at: true,
      updated_at: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};

const updateUserProfile = async (userId, data) => {
  const { profile_data, email, addresses, notification_preferences, ...rest } = data;
  const updateData = { ...rest };

  if (email !== undefined && email !== null) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        id: { not: userId },
      },
    });
    const existingAccount = await prisma.account.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        NOT: { customer: { id: userId } },
      },
    });
    if (existingUser || existingAccount) {
      throw new AppError('Email address is already in use by another account', 400);
    }
    updateData.email = normalizedEmail;
  }

  if (addresses !== undefined) {
    updateData.addresses = addresses;
  }

  if (notification_preferences !== undefined) {
    updateData.notification_preferences = notification_preferences;
  }

  if (profile_data !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_data: true },
    });
    updateData.profile_data = {
      ...(existing?.profile_data || {}),
      ...profile_data,
    };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      account_id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      addresses: true,
      profile_data: true,
      notification_preferences: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (updateData.email && user.account_id) {
    await prisma.account.update({
      where: { id: user.account_id },
      data: { email: updateData.email },
    });
  }

  return user;
};

const changeUserPassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  let accountPassword = null;
  if (user.account_id) {
    const account = await prisma.account.findUnique({ where: { id: user.account_id } });
    accountPassword = account?.password;
  }

  const existingPasswordHash = user.password || accountPassword;
  if (!existingPasswordHash) {
    throw new AppError('Password change is not available for this account', 400);
  }

  const isMatch = await comparePassword(currentPassword, existingPasswordHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  if (user.account_id) {
    await prisma.account.update({
      where: { id: user.account_id },
      data: { password: hashedPassword },
    });
  }
};

const updateNotificationPreferences = async (userId, preferences) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const currentPrefs = user.notification_preferences || { email: true, sms: false, push: true };
  const updatedPrefs = {
    ...currentPrefs,
    ...preferences
  };

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { notification_preferences: updatedPrefs },
    select: { notification_preferences: true }
  });

  return updatedUser.notification_preferences;
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  updateNotificationPreferences
};
