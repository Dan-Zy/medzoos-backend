const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authValidator = require('./auth.validator');
const { validate } = require('../../middleware/validate.middleware');
const { protect } = require('../../middleware/auth.middleware');
const { authRateLimiter, otpRateLimiter } = require('../../middleware/rateLimit.middleware');
const { initFirebaseAdmin } = require('../../config/firebase');

initFirebaseAdmin();

router.post('/register', authRateLimiter, validate(authValidator.registerSchema), authController.register);
router.post('/register/initiate', authRateLimiter, validate(authValidator.initiateRegisterSchema), authController.initiateRegister);
router.post('/register/verify-otp', otpRateLimiter, validate(authValidator.verifyRegisterOtpSchema), authController.verifyRegisterOtp);
router.post('/register/resend-otp', otpRateLimiter, validate(authValidator.resendRegisterOtpSchema), authController.resendRegisterOtp);

router.post('/login', authRateLimiter, validate(authValidator.loginSchema), authController.login);
router.post('/partner/login', authRateLimiter, validate(authValidator.partnerLoginSchema), authController.partnerLogin);

router.post('/firebase', otpRateLimiter, validate(authValidator.firebaseAuthSchema), authController.firebaseLogin);
router.post('/google', authRateLimiter, validate(authValidator.googleAuthSchema), authController.googleLogin);
router.post('/apple', authRateLimiter, validate(authValidator.appleAuthSchema), authController.appleLogin);

// Always register — returns 403 when disabled (avoids confusing 404 on production)
router.post('/dev-login', authRateLimiter, validate(authValidator.devLoginSchema), authController.devLogin);

router.post('/refresh', validate(authValidator.refreshSchema), authController.refresh);
router.post('/logout', protect, authController.logout);
router.post('/logout-all', protect, authController.logoutAll);

router.get('/sessions', protect, authController.getSessions);
router.delete('/sessions/:sessionId', protect, authController.revokeSession);
router.post('/sessions/revoke-others', protect, authController.revokeOtherSessions);

router.get('/me', protect, authController.me);
router.put('/profile', protect, validate(authValidator.updateProfileSchema), authController.updateProfile);
router.delete('/account', protect, authController.deleteAccount);

router.post('/forgot-password', authRateLimiter, validate(authValidator.forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password/:token', authRateLimiter, validate(authValidator.resetPasswordSchema), authController.resetPassword);
router.post('/reset-password-otp', authRateLimiter, validate(authValidator.verifyResetOtpSchema), authController.resetPasswordOtp);

module.exports = router;
