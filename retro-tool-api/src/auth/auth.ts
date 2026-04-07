import { betterAuth } from 'better-auth';
import { createEmailService } from '../lib/email';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, multiSession } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BETTER_AUTH_SESSION_EXPIRES_IN =
  parseInt(process.env.BETTER_AUTH_SESSION_EXPIRES_IN!, 10) || 60 * 60 * 24 * 7; // Default to 7 days if not set

const db = drizzle(pool, { schema });

const emailService = createEmailService(
  process.env.RESEND_API_KEY,
  process.env.EMAIL_FROM || 'Retro-Tool <onboarding@resend.dev>',
);

const trustedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPasswordEmail: async ({
      user,
      token,
    }: {
      user: { email: string; name: string };
      token: string;
    }) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  // Enable Bearer token authentication for API requests using the bearer plugin
  plugins: [bearer(), admin({ defaultRole: 'member' }), multiSession()],
  // Configure session settings
  session: {
    expiresIn: BETTER_AUTH_SESSION_EXPIRES_IN, // 7 day
    updateAge: 60 * 60 * 24, // 1 day
    // Store session token in cookie
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes
    },
  },
  // Advanced configuration for better-auth
  advanced: {
    // Generate UUID-format IDs so NestJS ParseUUIDPipe validation passes
    generateId: () => crypto.randomUUID(),
    // Use default cookie configuration
    defaultCookieAttributes: {
      // Azure App Service UI/API live on different subdomains, so cookies must
      // be cross-site in production.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
          },
        }
      : {}),
  },
});
