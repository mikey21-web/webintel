import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3456),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('webintel-assets'),
  R2_PUBLIC_URL: z.string().optional().default(''),
  CRAWL4AI_SIDECAR_URL: z.string().default('http://localhost:8765'),
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_JWK: z.string().optional(),
  SCOPED_JWT_SECRET: z.string().optional().default('dev-secret-change-in-production'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  APP_URL: z.string().default('http://localhost:3456'),
  WEBHOOK_SECRET: z.string().optional().default('dev-webhook-change-in-production'),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  CONFIDENCE_CALIBRATION_PATH: z.string().optional(),
  PROXY_PROVIDER: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  PROXY_HOST: z.string().optional(),
  PROXY_PORT: z.string().optional(),
  PROXY_URL: z.string().optional(),
  CAPTCHA_PROVIDER: z.string().optional(),
  CAPTCHA_API_KEY: z.string().optional(),
  CAPTCHA_APP_ID: z.string().optional(),
  CORS_ORIGINS: z.string().optional().default('*'),
});

const parsed = envSchema.safeParse(process.env);

const SECRETS = z.object({
  SCOPED_JWT_SECRET: z.string(),
  WEBHOOK_SECRET: z.string(),
});

const secretsParsed = SECRETS.safeParse(parsed.success ? parsed.data : {});

const hasRequiredSecrets = parsed.success && 
  secretsParsed.data?.SCOPED_JWT_SECRET !== 'dev-secret-change-in-production' &&
  secretsParsed.data?.SCOPED_JWT_SECRET !== '' &&
  secretsParsed.data?.WEBHOOK_SECRET !== 'dev-webhook-change-in-production' &&
  secretsParsed.data?.WEBHOOK_SECRET !== '';

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (hasRequiredSecrets) {
  console.log('[config] Required secrets validated.');
} else {
  console.warn(
    '[config] WARNING: SCOPED_JWT_SECRET or WEBHOOK_SECRET is using the dev default. ' +
    'Set real values in production via environment variables.'
  );
}

export const config = parsed.data;
