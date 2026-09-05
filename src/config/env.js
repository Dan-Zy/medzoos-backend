const { z } = require('zod');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  MEILISEARCH_HOST: z.string().optional(),
  MEILISEARCH_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  DO_SPACES_ENDPOINT: z.string().optional(),
  DO_SPACES_REGION: z.string().optional(),
  DO_SPACES_KEY: z.string().optional(),
  DO_SPACES_SECRET: z.string().optional(),
  DO_SPACES_BUCKET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('pkr'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  ENABLE_TEST_AUTH: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o'),
  OPENAI_OCR_PARSE_MODEL: z.string().default('gpt-4o'),
  PRESCRIPTION_OCR_TWO_PASS: z.string().default('true'),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  PRESCRIPTION_OCR_PROVIDER: z
    .enum(['auto', 'openai', 'google', 'stub'])
    .default('auto'),
  // Azure Communication Services & Email Configuration
  AZURE_COMMUNICATION_CONNECTION_STRING: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.azurecomm.net'),
  SMTP_PORT: z.string().or(z.number()).default(587).transform((v) => Number(v)),
  SMTP_SECURE: z.string().optional().transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ADMIN_PORTAL_URL: z.string().default('http://localhost:3001'),
  VENDOR_PORTAL_URL: z.string().default('http://localhost:3002'),
  DOCTOR_PORTAL_URL: z.string().default('http://localhost:3003'),
  LAB_PORTAL_URL: z.string().default('http://localhost:3004'),
  // Verified Sender Emails
  EMAIL_DONOTREPLY: z.string().default('DoNotReply@medzoos.pk'),
  EMAIL_INFO: z.string().default('info@medzoos.pk'),
  EMAIL_CONTACT: z.string().default('contact@medzoos.pk'),
  EMAIL_SUPPORT: z.string().default('support@medzoos.pk'),
  EMAIL_HR: z.string().default('hr@medzoos.pk'),
  EMAIL_AUTH: z.string().default('auth@medzoos.pk'),
  EMAIL_VERIFY: z.string().default('verify@medzoos.pk'),
  EMAIL_FEEDBACK: z.string().default('feedback@medzoos.pk'),
  EMAIL_SALES: z.string().default('sales@medzoos.pk'),
  EMAIL_ADMIN: z.string().default('admin@medzoos.pk'),
  EMAIL_HELP: z.string().default('help@medzoos.pk'),
  EMAIL_ACCOUNTS: z.string().default('accounts@medzoos.pk'),
  EMAIL_SECURITY: z.string().default('security@medzoos.pk'),
  EMAIL_SENDER_DISPLAY_NAME: z.string().default('Medzoos'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables', _env.error.format());
  process.exit(1);
}

module.exports = _env.data;
