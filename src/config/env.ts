import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 15m, 8h or 7d')
    .default('8h'),
  COOKIE_NAME: z.string().default('dt_token'),
  CLIENT_ORIGIN: z.url(),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_VIEWER_EMAIL: z.email().optional(),
  SEED_VIEWER_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
