import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_DIRECT_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      (str) => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    
    // Redis Configuration
    REDIS_URL: z.string().url().optional(),
    
    // S3/MinIO Configuration
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    
    // Multi-tenant Configuration
    DEFAULT_TENANT_ID: z.string().optional(),
    ENABLE_MULTI_TENANT: z.string().transform((val) => val === "true").default("true"),
    
    // Feature Flags
    ENABLE_AI_FEATURES: z.string().transform((val) => val === "true").default("false"),
    ENABLE_EXTERNAL_API_SYNC: z.string().transform((val) => val === "true").default("true"),
    ENABLE_AUDIT_LOGGING: z.string().transform((val) => val === "true").default("true"),
    
    // External API Configuration
    INTERNAL_API_BASE_URL: z.string().url().optional(),
    INTERNAL_API_KEY: z.string().optional(),
    POLLING_INTERVAL_MINUTES: z.string().transform((val) => parseInt(val, 10)).default("60"),
    
    // Email Configuration
    EMAIL_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().transform((val) => parseInt(val, 10)).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    
    // Monitoring and Observability
    ENABLE_METRICS: z.string().transform((val) => val === "true").default("true"),
    SENTRY_DSN: z.string().optional(),
    
    // Application Configuration
    APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("GWM CRM"),
    NEXT_PUBLIC_APP_VERSION: z.string().default("0.1.0"),
    NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().transform((val) => val === "true").default("false"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    
    // Server-side environment variables
    REDIS_URL: process.env.REDIS_URL,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID,
    ENABLE_MULTI_TENANT: process.env.ENABLE_MULTI_TENANT,
    ENABLE_AI_FEATURES: process.env.ENABLE_AI_FEATURES,
    ENABLE_EXTERNAL_API_SYNC: process.env.ENABLE_EXTERNAL_API_SYNC,
    ENABLE_AUDIT_LOGGING: process.env.ENABLE_AUDIT_LOGGING,
    INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    POLLING_INTERVAL_MINUTES: process.env.POLLING_INTERVAL_MINUTES,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    ENABLE_METRICS: process.env.ENABLE_METRICS,
    SENTRY_DSN: process.env.SENTRY_DSN,
    APP_ENV: process.env.APP_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    
    // Client-side environment variables
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});