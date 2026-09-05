const env = require('../../config/env');

/** Default inbox display name — also set in Azure Portal per sender address. */
const BRAND_NAME = env.EMAIL_SENDER_DISPLAY_NAME || 'Medzoos';

const EMAIL_CHANNELS = {
  DONOTREPLY: {
    key: 'DONOTREPLY',
    address: env.EMAIL_DONOTREPLY || 'DoNotReply@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'System-wide automated notifications and transactional updates',
  },
  INFO: {
    key: 'INFO',
    address: env.EMAIL_INFO || 'info@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Platform announcements and general public information',
  },
  CONTACT: {
    key: 'CONTACT',
    address: env.EMAIL_CONTACT || 'contact@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Contact form submissions and inquiry acknowledgments',
  },
  SUPPORT: {
    key: 'SUPPORT',
    address: env.EMAIL_SUPPORT || 'support@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Customer and patient help desk tickets',
  },
  HR: {
    key: 'HR',
    address: env.EMAIL_HR || 'hr@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Job applications, career inquiries, and recruitment',
  },
  AUTH: {
    key: 'AUTH',
    address: env.EMAIL_AUTH || 'auth@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Login verification, authentication OTPs, and access tokens',
  },
  VERIFY: {
    key: 'VERIFY',
    address: env.EMAIL_VERIFY || 'verify@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Account activation, email verification, and partner credential validation',
  },
  FEEDBACK: {
    key: 'FEEDBACK',
    address: env.EMAIL_FEEDBACK || 'feedback@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Post-consultation ratings, delivery reviews, and user surveys',
  },
  SALES: {
    key: 'SALES',
    address: env.EMAIL_SALES || 'sales@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'B2B commercial partnerships, pharmacy onboarding, and lab sales',
  },
  ADMIN: {
    key: 'ADMIN',
    address: env.EMAIL_ADMIN || 'admin@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Administrative system alerts, staff notices, and partner status changes',
  },
  HELP: {
    key: 'HELP',
    address: env.EMAIL_HELP || 'help@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'FAQ guidance, onboarding help, and consumer assistance',
  },
  ACCOUNTS: {
    key: 'ACCOUNTS',
    address: env.EMAIL_ACCOUNTS || 'accounts@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Invoices, payment receipts, refunds, and financial statements',
  },
  SECURITY: {
    key: 'SECURITY',
    address: env.EMAIL_SECURITY || 'security@medzoos.pk',
    displayName: BRAND_NAME,
    description: 'Password reset links, 2FA alerts, and account security notifications',
  },
};

/**
 * Resolves verified sender details by channel key (case-insensitive) or falls back to DONOTREPLY.
 * @param {string} channelKey
 * @returns {{ key: string, address: string, displayName: string, fromFormatted: string }}
 */
function resolveSender(channelKey = 'DONOTREPLY') {
  if (!channelKey) {
    channelKey = 'DONOTREPLY';
  }

  const rawKey = String(channelKey).trim();
  const normalizedKey = rawKey.toUpperCase().replace(/[^A-Z]/g, '');

  for (const item of Object.values(EMAIL_CHANNELS)) {
    if (
      item.key === normalizedKey ||
      item.address.toLowerCase() === rawKey.toLowerCase()
    ) {
      return {
        key: item.key,
        address: item.address,
        displayName: item.displayName,
        fromFormatted: `"${item.displayName}" <${item.address}>`,
      };
    }
  }

  const fallback = EMAIL_CHANNELS.DONOTREPLY;
  return {
    key: fallback.key,
    address: fallback.address,
    displayName: fallback.displayName,
    fromFormatted: `"${fallback.displayName}" <${fallback.address}>`,
  };
}

module.exports = {
  BRAND_NAME,
  EMAIL_CHANNELS,
  resolveSender,
};
