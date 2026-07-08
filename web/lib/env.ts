import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_UNPOOLED: z.string().min(1, 'DATABASE_URL_UNPOOLED is required'),
  GATE_DEFAULT_BOOTH_ID: z.string().min(1, 'GATE_DEFAULT_BOOTH_ID is required'),
  GATE_BASE_PRICE_PKR: z.coerce.number().int().positive(),
  GATE_ADDITIONAL_COPY_PRICE_PKR: z.coerce.number().int().positive(),
  GATE_MAX_PRINTS_PER_CODE: z.coerce.number().int().positive(),
  GATE_CODE_EXPIRY_HOURS: z.coerce.number().int().positive(),
  GATE_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive(),
});

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\nSee web/.env.local.example for the full list.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
