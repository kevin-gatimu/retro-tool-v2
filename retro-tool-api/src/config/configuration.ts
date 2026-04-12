import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(8000),
  nodeEnv: z
    .enum(['development', 'production', 'staging'])
    .default('development'),
  database: z.object({
    url: z.string(),
  }),
  auth: z.object({
    secret: z.string(),
    url: z.string().optional(),
    sessionExpiresIn: z.number().default(60 * 60 * 24 * 7), // 7 days
    cookieSecure: z.boolean().default(false),
    google: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
    microsoft: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        tenantId: z.string().optional(),
        authority: z.string().optional(),
      })
      .optional(),
  }),
  frontend: z.object({
    url: z.string(),
  }),
  // Comma-separated list of allowed origins for CORS and auth (ALLOWED_ORIGINS env var)
  allowedOrigins: z.array(z.string()),
  // Server URLs for Swagger
  localServerUrl: z.string(),
  deployedServerUrl: z.string(),
  email: z.object({
    resendApiKey: z.string().optional(),
    fromEmail: z.string(),
    sandboxTo: z.string().optional(),
  }),
  convex: z.object({
    url: z.url().optional(),
    adminKey: z.string().optional(),
  }),
  cronEnabled: z.boolean().default(true),
  weeklyDigestHour: z.number().int().min(0).max(23).default(6),
});

export type Config = z.infer<typeof configSchema>;

export default (): Config => {
  const nodeEnv = process.env.NODE_ENV as Config['nodeEnv'] | undefined;

  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    nodeEnv,
    database: {
      url: process.env.DATABASE_URL,
    },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET,
      url: process.env.BETTER_AUTH_URL,
      sessionExpiresIn: process.env.BETTER_AUTH_SESSION_EXPIRES_IN
        ? parseInt(process.env.BETTER_AUTH_SESSION_EXPIRES_IN, 10)
        : undefined,
      // Derived from NODE_ENV — true only in production
      cookieSecure: nodeEnv === 'production',
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID,
        authority: process.env.MICROSOFT_AUTHORITY,
      },
    },
    frontend: {
      url: process.env.FRONTEND_URL,
    },
    // Parse comma-separated ALLOWED_ORIGINS; falls back to FRONTEND_URL + LOCAL_SERVER_URL
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [process.env.FRONTEND_URL, process.env.LOCAL_SERVER_URL].filter(
          Boolean,
        ),
    localServerUrl: process.env.LOCAL_SERVER_URL,
    deployedServerUrl: process.env.DEPLOYED_SERVER_URL,
    email: {
      resendApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM,
      sandboxTo: process.env.EMAIL_SANDBOX_TO,
    },
    convex: {
      url: process.env.CONVEX_SYNC_URL,
      adminKey: process.env.CONVEX_SYNC_ADMIN_KEY,
    },
    cronEnabled: process.env.ENABLE_CRON_JOBS !== 'false',
    weeklyDigestHour: process.env.WEEKLY_DIGEST_SEND_HOUR
      ? parseInt(process.env.WEEKLY_DIGEST_SEND_HOUR, 10)
      : undefined,
  });
};
