const prisma = require('../../config/database');
const redisClient = require('../../config/redis');
const AppError = require('../../utils/AppError');
const { logger } = require('../../utils/logger');
const { hashPassword, comparePassword, generateTokens, generatePartnerTokens } = require('./auth.helper');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const crypto = require('crypto');
const { issueSession } = require('./services/token.service');

const storeRefreshToken = async (userId, refreshToken, value = 'valid') => {
  try {
    await redisClient.set(
      `refresh_token:${userId}:${refreshToken}`,
      value,
      'EX',
      7 * 24 * 60 * 60
    );
  } catch {
    // Allow auth to work when Redis is unavailable (local dev)
  }
};

const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const initiateRegister = async (data) => {
  const email = String(data.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('A valid email address is required', 400);
  }

  const existingAccount = await prisma.account.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existingAccount) {
    if (existingAccount.role !== 'customer' && existingAccount.role !== 'admin') {
      throw new AppError(
        `This email is already registered as a ${existingAccount.role} account. Use that portal, or sign up with a different email.`,
        400
      );
    }
    throw new AppError('Email already in use. Please sign in.', 400);
  }

  if (!data.password || String(data.password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  if (!data.name || String(data.name).trim().length < 2) {
    throw new AppError('Name must be at least 2 characters', 400);
  }

  const hashedPassword = await hashPassword(data.password);
  const otp = generateOtpCode();

  const stagedPayload = {
    name: String(data.name).trim(),
    email,
    hashedPassword,
    phone: data.phone ? String(data.phone).trim() : null,
    addresses: data.addresses || undefined,
    otp,
    createdAt: Date.now(),
  };

  try {
    await redisClient.set(`regOtp:${email}`, JSON.stringify(stagedPayload), 'EX', 15 * 60);
  } catch (err) {
    throw new AppError('Could not initiate registration. Please try again.', 503);
  }

  // Dispatch branded OTP email — registration cannot proceed without delivery
  try {
    const { sendOtpEmail } = require('../../notifications/email/email.service');
    await sendOtpEmail({
      to: email,
      name: stagedPayload.name,
      code: otp,
      purpose: 'account registration',
      expiresInMinutes: 15,
    });
  } catch (emailErr) {
    try {
      await redisClient.del(`regOtp:${email}`);
    } catch {
      // ignore cleanup errors
    }
    throw new AppError(
      'Could not send verification email. Please check your email address and try again.',
      503,
    );
  }

  return {
    email,
    requireOtp: true,
    message: 'Verification code sent to your email address.',
  };
};

const verifyRegisterOtp = async (data, meta, res) => {
  const email = String(data.email || '').trim().toLowerCase();
  const inputOtp = String(data.otp || '').trim();

  if (!email || !inputOtp) {
    throw new AppError('Email and 6-digit verification code are required', 400);
  }

  let stagedRaw;
  try {
    stagedRaw = await redisClient.get(`regOtp:${email}`);
  } catch {
    throw new AppError('Registration service temporarily unavailable', 503);
  }

  if (!stagedRaw) {
    throw new AppError('Verification code has expired or registration session was not found. Please register again.', 400);
  }

  let staged;
  try {
    staged = JSON.parse(stagedRaw);
  } catch {
    throw new AppError('Invalid registration session data. Please register again.', 400);
  }

  if (staged.otp !== inputOtp) {
    throw new AppError('Invalid verification code. Please check your email and enter the 6-digit code.', 400);
  }

  const existing = await prisma.account.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) {
    await redisClient.del(`regOtp:${email}`);
    throw new AppError('Email already registered. Please sign in.', 400);
  }

  // Create Unified Account and Customer
  const account = await prisma.account.create({
    data: {
      email,
      password: staged.hashedPassword,
      role: 'customer',
      customer: {
        create: {
          name: staged.name,
          email,
          phone: staged.phone || null,
          addresses: staged.addresses,
          role: 'customer',
          is_verified: true,
        },
      },
    },
    include: { customer: true },
  });

  // Clean up staged OTP
  await redisClient.del(`regOtp:${email}`);

  // Asynchronously send welcome email from auth@medzoos.pk
  try {
    const { sendWelcomeEmail } = require('../../notifications/email/email.service');
    void sendWelcomeEmail({
      to: email,
      name: staged.name,
      email,
      role: 'patient',
      loginUrl: `${String(env.FRONTEND_URL || 'https://hub.asrar.dev').replace(/\/$/, '')}/login`,
    }).catch((err) => {
      console.warn(`Could not dispatch welcome email to ${email}: ${err.message}`);
    });
  } catch {
    // Non-blocking
  }

  return issueSession(account.customer, account, meta, res, { includeAccessToken: false });
};

const resendRegisterOtp = async (emailInput) => {
  const email = String(emailInput || '').trim().toLowerCase();
  if (!email) throw new AppError('Email is required', 400);

  let stagedRaw;
  try {
    stagedRaw = await redisClient.get(`regOtp:${email}`);
  } catch {
    throw new AppError('Service temporarily unavailable', 503);
  }

  if (!stagedRaw) {
    throw new AppError('No pending registration found for this email. Please fill out the registration form.', 400);
  }

  let staged;
  try {
    staged = JSON.parse(stagedRaw);
  } catch {
    throw new AppError('Invalid registration session. Please register again.', 400);
  }

  const newOtp = generateOtpCode();
  staged.otp = newOtp;
  staged.createdAt = Date.now();

  await redisClient.set(`regOtp:${email}`, JSON.stringify(staged), 'EX', 15 * 60);

  try {
    const { sendOtpEmail } = require('../../notifications/email/email.service');
    void sendOtpEmail({
      to: email,
      name: staged.name,
      code: newOtp,
      purpose: 'account registration',
      expiresInMinutes: 15,
    }).catch((err) => {
      console.warn(`Could not dispatch resent OTP email to ${email}: ${err.message}`);
    });
  } catch (emailErr) {
    console.warn(`Could not trigger OTP resend email: ${emailErr.message}`);
  }

  return { email, message: 'New verification code sent to your email.' };
};

const registerUser = async (data, meta, res) => {
  if (data.otp) {
    return verifyRegisterOtp(data, meta, res);
  }

  // If in automated test mode without OTP requirement
  if (process.env.NODE_ENV === 'test' && !data.requireOtp) {
    const email = String(data.email || '').trim().toLowerCase();
    const existingAccount = await prisma.account.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingAccount) {
      if (existingAccount.role !== 'customer' && existingAccount.role !== 'admin') {
        throw new AppError(
          `This email is already registered as a ${existingAccount.role} account. Use that portal, or sign up with a different email.`,
          400
        );
      }
      throw new AppError('Email already in use', 400);
    }

    const hashedPassword = await hashPassword(data.password);
    const account = await prisma.account.create({
      data: {
        email,
        password: hashedPassword,
        role: 'customer',
        customer: {
          create: {
            name: data.name,
            email,
            phone: data.phone || null,
            addresses: data.addresses,
            role: 'customer',
          },
        },
      },
      include: { customer: true },
    });

    try {
      const { sendWelcomeEmail } = require('../../notifications/email/email.service');
      void sendWelcomeEmail({
        to: email,
        name: data.name,
        email,
        role: 'patient',
        loginUrl: `${String(env.FRONTEND_URL || 'https://hub.asrar.dev').replace(/\/$/, '')}/login`,
      }).catch(() => {});
    } catch {}

    return issueSession(account.customer, account, meta, res, { includeAccessToken: false });
  }

  return initiateRegister(data);
};

const loginUser = async (email, password, meta, res) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const account = await prisma.account.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    include: { customer: true }
  });
  
  if (!account) {
    // Fallback to old user table during transition
    const legacyUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (!legacyUser) throw new AppError('Invalid email or password', 401);
    
    const isMatch = await comparePassword(password, legacyUser.password);
    if (!isMatch) throw new AppError('Invalid email or password', 401);
    
    return issueSession(legacyUser, null, meta, res, { includeAccessToken: false });
  }

  if (account.role !== 'customer' && account.role !== 'admin') {
    throw new AppError(
      `This email is registered as a ${account.role} account. Please use the ${account.role} portal to log in.`,
      400
    );
  }

  if (!account.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  if (!account.password) {
    throw new AppError('This account does not have a password yet. Use Forgot password to create one.', 400);
  }

  const isMatch = await comparePassword(password, account.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  let profile = account.customer;
  if (!profile && account.role === 'admin') {
    profile = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (!profile) {
      profile = await prisma.user.create({
        data: {
          account_id: account.id,
          email: normalizedEmail,
          name: 'Super Admin',
          role: 'admin',
        },
      });
    } else if (!profile.account_id) {
      await prisma.user.update({
        where: { id: profile.id },
        data: { account_id: account.id },
      });
    }
  }

  if (!profile) {
    throw new AppError('Profile not found for this account', 404);
  }

  return issueSession(profile, account, meta, res, { includeAccessToken: false });
};

const refreshAuthToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const accountId = decoded.accountId || decoded.id;
    
    let isRevoked = false;
    try {
      const redisVal = await redisClient.get(`refresh_token:${accountId}:${refreshToken}`);
      if (redisVal === 'revoked') {
        isRevoked = true;
      }
    } catch {
      // Redis unavailable or optional
    }

    if (isRevoked) {
      throw new AppError('Refresh token revoked or invalid', 401);
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { customer: true, vendor: true, doctor: true, lab_partner: true },
    });

    if (!account) {
      // Legacy refresh fallback
      return await handleLegacyRefresh(decoded, refreshToken);
    }

    if (!account.is_active) throw new AppError('Account disabled', 403);

    let profile = null;
    let tokens;

    if (account.role === 'customer' || account.role === 'admin') profile = account.customer;
    if (account.role === 'vendor') profile = account.vendor;
    if (account.role === 'doctor') profile = account.doctor;
    if (account.role === 'lab') profile = account.lab_partner;

    const payload = { ...profile, accountId: account.id, role: account.role };

    if (['vendor', 'doctor', 'lab'].includes(account.role)) {
      tokens = generatePartnerTokens(payload, account.role);
    } else {
      tokens = generateTokens(payload);
    }

    try {
      await redisClient.del(`refresh_token:${accountId}:${refreshToken}`);
      await storeRefreshToken(account.id, tokens.refreshToken, account.role);
    } catch {
      // Best-effort cache storage
    }

    return tokens;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid refresh token', 401);
  }
};

async function handleLegacyRefresh(decoded, refreshToken) {
  // Legacy logic fallback code
  let legacyAccount;
  let tokens;
  if (decoded.role && ['vendor', 'doctor', 'lab'].includes(decoded.role)) {
    if (decoded.role === 'vendor') legacyAccount = await prisma.vendor.findUnique({ where: { id: decoded.id } });
    if (decoded.role === 'doctor') legacyAccount = await prisma.doctor.findUnique({ where: { id: decoded.id } });
    if (decoded.role === 'lab') legacyAccount = await prisma.labPartner.findUnique({ where: { id: decoded.id } });
    if (!legacyAccount) throw new AppError('Partner account not found', 404);
    tokens = generatePartnerTokens(legacyAccount, decoded.role);
  } else {
    legacyAccount = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!legacyAccount) throw new AppError('User not found', 404);
    tokens = generateTokens(legacyAccount);
  }
  await redisClient.del(`refresh_token:${decoded.id}:${refreshToken}`);
  await storeRefreshToken(legacyAccount.id, tokens.refreshToken, decoded.role || 'customer');
  return tokens;
}

const logoutUser = async (userId, refreshToken) => {
  if (refreshToken) {
    // We could delete just the specific token
    await redisClient.del(`refresh_token:${userId}:${refreshToken}`);
    // Or we could delete all refresh tokens for this user by pattern matching (more complex in redis but safer)
  }
};

const forgotPassword = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const account = await prisma.account.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
    },
    include: {
      customer: true,
      vendor: true,
      doctor: true,
      lab_partner: true,
    },
  });

  let subject = null;
  let targetRole = 'customer';

  if (account) {
    subject = `account:${account.id}`;
    targetRole = account.role;
  } else {
    const [legacyUser, legacyVendor, legacyDoctor, legacyLab] = await Promise.all([
      prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } }),
      prisma.vendor.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } }),
      prisma.doctor.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } }),
      prisma.labPartner.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } }),
    ]);

    if (legacyUser) {
      subject = `legacy_user:${legacyUser.id}`;
      targetRole = 'customer';
    } else if (legacyVendor) {
      subject = `legacy_vendor:${legacyVendor.id}`;
      targetRole = 'vendor';
    } else if (legacyDoctor) {
      subject = `legacy_doctor:${legacyDoctor.id}`;
      targetRole = 'doctor';
    } else if (legacyLab) {
      subject = `legacy_lab:${legacyLab.id}`;
      targetRole = 'lab';
    } else {
      return;
    }
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetOtp = generateOtpCode();

  try {
    await redisClient.set(`pwdReset:${hashedToken}`, subject, 'EX', 15 * 60);
    await redisClient.set(
      `pwdResetOtp:${normalizedEmail}`,
      JSON.stringify({ subject, otp: resetOtp, hashedToken, role: targetRole }),
      'EX',
      15 * 60
    );
  } catch {
    throw new AppError('Password reset is temporarily unavailable. Please try again shortly.', 503);
  }

  let portalUrl = String(env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (targetRole === 'lab') {
    portalUrl = String(process.env.LAB_PORTAL_URL || 'http://localhost:3004').replace(/\/$/, '');
  } else if (targetRole === 'doctor') {
    portalUrl = String(process.env.DOCTOR_PORTAL_URL || 'http://localhost:3003').replace(/\/$/, '');
  } else if (targetRole === 'vendor') {
    portalUrl = String(process.env.VENDOR_PORTAL_URL || 'http://localhost:3002').replace(/\/$/, '');
  } else if (targetRole === 'admin') {
    portalUrl = String(process.env.ADMIN_PORTAL_URL || 'http://localhost:3001').replace(/\/$/, '');
  }

  const resetUrl = `${portalUrl}/reset-password/${resetToken}`;
  logger.info(`Password reset generated for ${normalizedEmail} (${targetRole}): Code: ${resetOtp}, Link: ${resetUrl}`);
  console.log(`Password reset for ${normalizedEmail} (${targetRole}): Code: ${resetOtp}, Link: ${resetUrl}`);

  try {
    const { sendPasswordResetEmail } = require('../../notifications/email/email.service');
    await sendPasswordResetEmail({
      to: normalizedEmail,
      email: normalizedEmail,
      resetUrl,
      role: targetRole,
      code: resetOtp,
      expiresInMinutes: 15,
    });
    logger.info(`Password reset email successfully dispatched to ${normalizedEmail}`);
  } catch (emailErr) {
    try {
      await redisClient.del(`pwdReset:${hashedToken}`);
      await redisClient.del(`pwdResetOtp:${normalizedEmail}`);
    } catch {
      // ignore cleanup errors
    }
    logger.error(`Could not dispatch password reset email: ${emailErr.message}`);
    throw new AppError(
      'Could not send password reset email. Please check your email address and try again.',
      503,
    );
  }
};

const applyPasswordUpdateToSubject = async (subject, hashedPassword) => {
  if (subject.startsWith('account:')) {
    const accountId = subject.slice('account:'.length);
    await prisma.account.update({
      where: { id: accountId },
      data: { password: hashedPassword },
    });
    await Promise.allSettled([
      prisma.user.updateMany({ where: { account_id: accountId }, data: { password: hashedPassword } }),
      prisma.vendor.updateMany({ where: { account_id: accountId }, data: { password: hashedPassword } }),
      prisma.doctor.updateMany({ where: { account_id: accountId }, data: { password: hashedPassword } }),
      prisma.labPartner.updateMany({ where: { account_id: accountId }, data: { password: hashedPassword } }),
    ]);
  } else if (subject.startsWith('legacy_user:')) {
    await prisma.user.update({
      where: { id: subject.slice('legacy_user:'.length) },
      data: { password: hashedPassword },
    });
  } else if (subject.startsWith('legacy_vendor:')) {
    await prisma.vendor.update({
      where: { id: subject.slice('legacy_vendor:'.length) },
      data: { password: hashedPassword },
    });
  } else if (subject.startsWith('legacy_doctor:')) {
    await prisma.doctor.update({
      where: { id: subject.slice('legacy_doctor:'.length) },
      data: { password: hashedPassword },
    });
  } else if (subject.startsWith('legacy_lab:')) {
    await prisma.labPartner.update({
      where: { id: subject.slice('legacy_lab:'.length) },
      data: { password: hashedPassword },
    });
  } else {
    const legacy = await prisma.user.findUnique({ where: { id: subject } }).catch(() => null);
    if (legacy) {
      await prisma.user.update({
        where: { id: subject },
        data: { password: hashedPassword },
      });
    } else {
      await prisma.account.update({
        where: { id: subject },
        data: { password: hashedPassword },
      });
    }
  }
};

const resetPassword = async (token, newPassword) => {
  if (!newPassword || String(newPassword).length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  let stored;
  try {
    stored = await redisClient.get(`pwdReset:${hashedToken}`);
  } catch {
    throw new AppError('Password reset is temporarily unavailable. Please try again shortly.', 503);
  }

  if (!stored) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  const hashedPassword = await hashPassword(newPassword);
  await applyPasswordUpdateToSubject(stored, hashedPassword);

  await redisClient.del(`pwdReset:${hashedToken}`);
};

const verifyResetOtpAndSetPassword = async ({ email, otp, password }) => {
  if (!password || String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const inputOtp = String(otp || '').trim();

  let storedRaw;
  try {
    storedRaw = await redisClient.get(`pwdResetOtp:${normalizedEmail}`);
  } catch {
    throw new AppError('Password reset is temporarily unavailable. Please try again shortly.', 503);
  }

  if (!storedRaw) {
    throw new AppError('Reset code has expired or is invalid. Please request a new code.', 400);
  }

  let stored;
  try {
    stored = JSON.parse(storedRaw);
  } catch {
    throw new AppError('Invalid reset session. Please request a new code.', 400);
  }

  if (stored.otp !== inputOtp) {
    throw new AppError('Invalid 6-digit verification code. Please check the code sent to your email.', 400);
  }

  const hashedPassword = await hashPassword(password);
  await applyPasswordUpdateToSubject(stored.subject, hashedPassword);

  await redisClient.del(`pwdResetOtp:${normalizedEmail}`);
  if (stored.hashedToken) {
    await redisClient.del(`pwdReset:${stored.hashedToken}`);
  }

  // Asynchronously send security notification email from security@medzoos.pk
  try {
    const { sendSecurityAlertEmail } = require('../../notifications/email/email.service');
    void sendSecurityAlertEmail({
      to: normalizedEmail,
      email: normalizedEmail,
      alertType: 'Password Changed Successfully',
      details: 'Your Medzoos account password was recently reset. If you did not perform this change, please contact security@medzoos.pk immediately.',
    }).catch(() => {});
  } catch {}

  return { message: 'Password reset successfully' };
};

const isApprovedPartnerStatus = (status) => ['approved', 'active'].includes(status);

const PARTNER_PORTALS = ['vendor', 'doctor', 'lab'];
const PORTAL_LABELS = { vendor: 'Vendor', doctor: 'Doctor', lab: 'Lab' };

const assertPartnerPortalAccess = (portal, accountRole) => {
  if (accountRole === portal) return;

  if (PARTNER_PORTALS.includes(accountRole)) {
    throw new AppError(
      `This email is registered as a ${PORTAL_LABELS[accountRole]} account. Please use the ${PORTAL_LABELS[accountRole]} portal to log in.`,
      400
    );
  }

  throw new AppError(
    'This account cannot access partner portals. Use the customer or admin login instead.',
    403
  );
};

const loginPartner = async (portal, email, password, meta = {}) => {
  const account = await prisma.account.findUnique({ 
    where: { email: email.trim().toLowerCase() },
    include: { vendor: true, doctor: true, lab_partner: true, vendor_staff: true }
  });

  if (!account) {
    // Fallback to legacy
    return await legacyLoginPartner(portal, email, password);
  }

  assertPartnerPortalAccess(portal, account.role);

  const isMatch = await comparePassword(password, account.password);
  if (!isMatch && portal === 'vendor' && account.vendor?.password) {
    const legacyMatch = await comparePassword(password, account.vendor.password);
    if (legacyMatch) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: account.vendor.password }
      });
    } else {
      throw new AppError('Invalid email or password', 401);
    }
  } else if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!account.is_active) throw new AppError('Account disabled', 403);

  let profile = null;
  if (portal === 'vendor') {
    profile = account.vendor;
    if (!profile && account.vendor_staff) {
      const staff = account.vendor_staff;
      if (staff.status !== 'active') throw new AppError('Your staff account is disabled', 403);
      profile = await prisma.vendor.findUnique({ where: { id: staff.vendor_id } });
      if (!profile) throw new AppError('Vendor profile not found for this account', 403);
      profile = { ...profile, staffRole: staff.role, staffId: staff.id, staffName: staff.name };
    }
    if (!profile) throw new AppError('Vendor profile not found for this account', 403);
    if (String(profile.status).toLowerCase() === 'rejected') {
      throw new AppError('Your vendor account was rejected. Contact Medzoos support.', 403);
    }
    await prisma.vendorLoginActivity.create({
      data: {
        vendor_id: profile.id,
        account_id: account.id,
        staff_id: profile.staffId || null,
        ip_address: meta.ip || null,
        user_agent: meta.userAgent || null,
        success: true,
      },
    }).catch(() => {});
  } else if (portal === 'doctor') {
    profile = account.doctor;
    if (!profile) throw new AppError('Doctor profile not found for this account', 403);
    if (!profile.is_active) throw new AppError('Your doctor account is inactive. Contact support to reactivate it.', 403);
  } else if (portal === 'lab') {
    profile = account.lab_partner;
    if (!profile) throw new AppError('Lab profile not found for this account', 403);
    if (!isApprovedPartnerStatus(profile.status)) {
      throw new AppError('Your account is pending approval or rejected', 403);
    }
  }

  const role = portal;
  const payload = { ...profile, accountId: account.id, role };
  const tokens = generatePartnerTokens(payload, role);

  await storeRefreshToken(account.id, tokens.refreshToken, role);
  return { partner: { ...profile, accountId: account.id }, role, tokens };
};

async function legacyLoginPartner(portal, email, password) {
  let partner;
  if (portal === 'vendor') {
    partner = await prisma.vendor.findUnique({ where: { email } });
    if (!partner) throw new AppError('Invalid email or password', 401);
    if (!isApprovedPartnerStatus(partner.status)) throw new AppError('Your vendor account is pending approval or has been rejected', 403);
  } else if (portal === 'doctor') {
    partner = await prisma.doctor.findUnique({ where: { email } });
    if (!partner || !partner.password) throw new AppError('Invalid email or password', 401);
    if (!partner.is_active) throw new AppError('Your doctor account is inactive', 403);
  } else if (portal === 'lab') {
    partner = await prisma.labPartner.findUnique({ where: { email } });
    if (!partner) throw new AppError('Invalid email or password', 401);
    if (!isApprovedPartnerStatus(partner.status)) throw new AppError('Your lab account is pending approval or has been rejected', 403);
  } else {
    throw new AppError('Invalid portal type', 400);
  }

  const isMatch = await comparePassword(password, partner.password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const role = portal === 'lab' ? 'lab' : portal;
  const tokens = generatePartnerTokens(partner, role);
  await storeRefreshToken(partner.id, tokens.refreshToken, role);

  return { partner, role, tokens };
}

module.exports = {
  initiateRegister,
  verifyRegisterOtp,
  resendRegisterOtp,
  registerUser,
  loginUser,
  refreshAuthToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyResetOtpAndSetPassword,
  loginPartner,
};
