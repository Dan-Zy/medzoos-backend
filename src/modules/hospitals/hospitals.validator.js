const { z } = require('zod');

// Pakistani phone regex: +923XXXXXXXXX, 03XXXXXXXXX, or landlines
const pakistaniPhoneRegex = /^(?:\+92|92|0)?(?:3\d{9}|[2-9]\d{7,9})$/;

const hospitalBodySchema = z.object({
  name: z.string().min(2, "Hospital name must be at least 2 characters"),
  logo: z.string().optional(),
  cover_image: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z
    .string()
    .max(16, "Phone number cannot exceed standard digit count")
    .refine(
      (val) => !val || !val.trim() || pakistaniPhoneRegex.test(val.replace(/[\s\-\(\)]/g, '')),
      { message: "Invalid Pakistani phone number. Format: +92 300 1234567 or 03001234567" }
    )
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

const createHospitalSchema = z.object({
  body: hospitalBodySchema,
});

const updateHospitalSchema = z.object({
  body: hospitalBodySchema.partial(),
});

const hospitalStatusSchema = z.object({
  body: z.object({
    is_active: z.boolean(),
  }),
});

module.exports = {
  createHospitalSchema,
  updateHospitalSchema,
  hospitalStatusSchema,
};

