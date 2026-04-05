import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(8000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
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
      })
      .optional(),
  }),
  frontend: z.object({
    url: z.string().default('http://localhost:5173'),
  }),
  // Comma-separated list of allowed origins for CORS and auth
  allowedOrigins: z
    .array(z.string())
    .default(['http://localhost:5173', 'http://localhost:8000']),
  // Server URLs for Swagger
  localServerUrl: z.string().default('http://localhost:8000'),
  deployedServerUrl: z.string().default('https://retro-tool.azurewebsites.net'),
  email: z.object({
    resendApiKey: z.string().optional(),
    fromEmail: z.string().default('noreply@example.com'),
  }),
  convex: z.object({
    url: z.string().url().optional(),
    adminKey: z.string().optional(),
  }),
  cronEnabled: z.boolean().default(true),
  weeklyDigestHour: z.number().int().min(0).max(23).default(6),
});

export type Config = z.infer<typeof configSchema>;

export default (): Config => {
  return configSchema.parse({
    port: parseInt(process.env.PORT || '8000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      url: process.env.DATABASE_URL,
    },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET,
      url: process.env.BETTER_AUTH_URL,
      sessionExpiresIn: parseInt(
        process.env.BETTER_AUTH_SESSION_EXPIRES_IN || '604800',
        10,
      ),
      cookieSecure: process.env.NODE_ENV === 'production',
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID,
      },
    },
    frontend: {
      url: process.env.FRONTEND_URL || 'http://localhost:5173',
    },
    // Parse comma-separated origins, fallback to defaults
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [
          process.env.FRONTEND_URL || 'http://localhost:5173',
          'http://localhost:8000',
        ],
    // Server URLs for Swagger
    localServerUrl: process.env.LOCAL_SERVER_URL || 'http://localhost:8000',
    deployedServerUrl:
      process.env.DEPLOYED_SERVER_URL || 'https://retro-tool.azurewebsites.net',
    email: {
      resendApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'noreply@example.com',
    },
    convex: {
      url: process.env.CONVEX_SYNC_URL || undefined,
      adminKey: process.env.CONVEX_SYNC_ADMIN_KEY || undefined,
    },
    cronEnabled: process.env.ENABLE_CRON_JOBS !== 'false',
    weeklyDigestHour: parseInt(process.env.WEEKLY_DIGEST_SEND_HOUR || '6', 10),
  });
};
