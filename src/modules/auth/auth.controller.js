const catchAsync = require('../../utils/catchAsync');
const authService = require('./auth.service');
const firebaseAuthService = require('./services/firebase.service');
const devAuthService = require('./services/dev-auth.service');
const authSessionService = require('./services/auth-session.service');
const { sendResponse } = require('../../utils/response');
const { setTokenCookies, clearTokenCookies } = require('./auth.helper');

const register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(
    req.body,
    {
      deviceId: req.body?.deviceId || req.headers['x-device-id'],
      platform: req.body?.platform || 'web',
    },
    res,
  );
  
  if (result.requireOtp) {
    return sendResponse(res, 200, result, result.message || 'Verification code sent to your email');
  }

  if (result.user) {
    result.user.password = undefined;
  }

  sendResponse(res, 201, result, 'User registered successfully');
});

const initiateRegister = catchAsync(async (req, res) => {
  const result = await authService.initiateRegister(req.body);
  sendResponse(res, 200, result, result.message);
});

const verifyRegisterOtp = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.verifyRegisterOtp(
    req.body,
    {
      deviceId: req.body?.deviceId || req.headers['x-device-id'],
      platform: req.body?.platform || 'web',
    },
    res,
  );

  if (user) {
    user.password = undefined;
  }

  sendResponse(res, 201, { user, tokens }, 'Account verified and registered successfully');
});

const resendRegisterOtp = catchAsync(async (req, res) => {
  const result = await authService.resendRegisterOtp(req.body.email);
  sendResponse(res, 200, result, result.message);
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const { user, tokens } = await authService.loginUser(
    email,
    password,
    {
      deviceId: req.body?.deviceId || req.headers['x-device-id'],
      platform: req.body?.platform || 'web',
    },
    res,
  );

  user.password = undefined;

  sendResponse(res, 200, { user, tokens }, 'Login successful');
});

const firebaseLogin = catchAsync(async (req, res) => {
  const { idToken, deviceId, platform } = req.body;
  const result = await firebaseAuthService.authenticateWithFirebaseIdToken(
    idToken,
    { deviceId: deviceId || req.headers['x-device-id'], platform: platform || 'web' },
    res,
  );
  sendResponse(res, 200, result, 'Authentication successful');
});

const googleLogin = catchAsync(async (req, res) => {
  const { idToken, code, deviceId, platform } = req.body;
  const result = await firebaseAuthService.authenticateWithGoogle(
    { idToken, code },
    { deviceId: deviceId || req.headers['x-device-id'], platform: platform || 'web' },
    res,
  );
  sendResponse(res, 200, result, 'Google authentication successful');
});

const appleLogin = catchAsync(async (req, res) => {
  const { idToken, deviceId, platform } = req.body;
  const result = await firebaseAuthService.authenticateWithAppleIdToken(
    idToken,
    { deviceId: deviceId || req.headers['x-device-id'], platform: platform || 'ios' },
    res,
  );
  sendResponse(res, 200, result, 'Apple authentication successful');
});

const devLogin = catchAsync(async (req, res) => {
  const { phone, code, deviceId, platform } = req.body;
  const result = await devAuthService.authenticateDevTestLogin(
    phone,
    code,
    { deviceId: deviceId || req.headers['x-device-id'], platform: platform || 'web' },
    res,
  );
  sendResponse(res, 200, result, 'Dev test login successful');
});

const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ status: 'fail', message: 'No refresh token provided' });
  }

  let result;
  try {
    result = await authSessionService.refreshAuthSession(
      refreshToken,
      {
        deviceId: req.body?.deviceId || req.headers['x-device-id'],
        platform: req.body?.platform,
      },
      res,
    );
  } catch (err) {
    const tokens = await authService.refreshAuthToken(refreshToken);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    result = {
      tokens,
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  sendResponse(res, 200, result, 'Token refreshed successfully');
});

const logout = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;
  
  if (req.user && refreshToken) {
    await authSessionService.logoutSession(req.user.id, refreshToken);
    await authService.logoutUser(req.user.accountId || req.user.id, refreshToken);
  }

  clearTokenCookies(res);
  
  sendResponse(res, 200, null, 'Logged out successfully');
});

const logoutAll = catchAsync(async (req, res) => {
  await authSessionService.logoutAllSessions(req.user.id);
  clearTokenCookies(res);
  sendResponse(res, 200, null, 'Logged out from all devices');
});

const me = catchAsync(async (req, res) => {
  const user = await authSessionService.getAuthenticatedUser(req.user.id);
  sendResponse(res, 200, { user }, 'Profile retrieved');
});

const updateProfile = catchAsync(async (req, res) => {
  const user = await authSessionService.updateUserProfile(req.user.id, req.body);
  sendResponse(res, 200, { user }, 'Profile updated');
});

const deleteAccount = catchAsync(async (req, res) => {
  await authSessionService.deleteUserAccount(req.user.id);
  clearTokenCookies(res);
  sendResponse(res, 200, null, 'Account deleted successfully');
});

const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  sendResponse(res, 200, null, 'If an account exists, a reset link was sent.');
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  sendResponse(res, 200, null, 'Password reset successfully');
});

const resetPasswordOtp = catchAsync(async (req, res) => {
  const result = await authService.verifyResetOtpAndSetPassword(req.body);
  sendResponse(res, 200, result, 'Password reset successfully');
});

const partnerLogin = catchAsync(async (req, res) => {
  const { portal, email, password } = req.body;
  const { partner, role, tokens } = await authService.loginPartner(portal, email, password, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

  const sanitized = { ...partner };
  delete sanitized.password;

  sendResponse(res, 200, { partner: sanitized, role, tokens }, 'Partner login successful');
});

const getSessions = catchAsync(async (req, res) => {
  const currentRefreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
  const sessions = await authSessionService.listUserSessions(req.user.id, currentRefreshToken);
  sendResponse(res, 200, { sessions }, 'Active sessions retrieved successfully');
});

const revokeSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  await authSessionService.revokeUserSession(req.user.id, sessionId);
  sendResponse(res, 200, null, 'Session revoked successfully');
});

const revokeOtherSessions = catchAsync(async (req, res) => {
  const currentRefreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'] || req.body?.refreshToken;
  await authSessionService.revokeOtherUserSessions(req.user.id, currentRefreshToken);
  sendResponse(res, 200, null, 'All other sessions revoked successfully');
});

module.exports = {
  register,
  initiateRegister,
  verifyRegisterOtp,
  resendRegisterOtp,
  login,
  firebaseLogin,
  googleLogin,
  appleLogin,
  devLogin,
  refresh,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
  revokeOtherSessions,
  me,
  updateProfile,
  deleteAccount,
  forgotPassword,
  resetPassword,
  resetPasswordOtp,
  partnerLogin,
};
