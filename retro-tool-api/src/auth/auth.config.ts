import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, multiSession } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Config } from '../config/configuration';
import { createEmailService } from '../lib/email';
import * as schema from './schema';

/**
 * Factory function to create Better Auth instance with configuration
 * This allows proper integration with NestJS ConfigService
 */
export function createAuth(configService: ConfigService<Config>) {
  const authSecret = configService.get('auth.secret', { infer: true });
  const sessionExpiresIn = configService.get('auth.sessionExpiresIn', {
    infer: true,
  });
  const cookieSecure = configService.get('auth.cookieSecure', { infer: true });
  const databaseUrl = configService.get('database.url', { infer: true });
  const frontendUrl = configService.get('frontend.url', { infer: true });
  const emailConfig = configService.get('email', { infer: true });
  const port = configService.get('port', { infer: true }) ?? 8000;

  const emailService = createEmailService(
    emailConfig?.resendApiKey,
    emailConfig?.fromEmail ?? 'Retro-Tool <onboarding@resend.dev>',
  );

  // Get auth config object for nested properties
  const authConfig = configService.get('auth', { infer: true });
  const googleClientId = authConfig?.google?.clientId;
  const googleClientSecret = authConfig?.google?.clientSecret;
  const microsoftClientId = authConfig?.microsoft?.clientId;
  const microsoftClientSecret = authConfig?.microsoft?.clientSecret;
  const microsoftTenantId = authConfig?.microsoft?.tenantId;

  // Create database pool and drizzle instance using ConfigService
  // Check if this is an Azure PostgreSQL connection
  const isAzurePostgres =
    databaseUrl?.includes('.postgres.database.azure.com') || false;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isAzurePostgres ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  // Get allowed origins from config
  const allowedOrigins = configService.get('allowedOrigins', { infer: true })!;

  // Use BETTER_AUTH_URL if set (required for production); fall back to localhost for local dev
  const authUrl = authConfig?.url || `http://localhost:${port}`;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    // Allow configured origins for Swagger UI and frontend
    trustedOrigins: allowedOrigins,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({
        user,
        token,
      }: {
        user: { email: string; name: string };
        token: string;
      }) => {
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
        await emailService.sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({
        user,
        token,
      }: {
        user: { email: string; name: string };
        token: string;
      }) => {
        const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`;
        await emailService.sendVerificationEmail({
          to: user.email,
          name: user.name,
          verificationUrl,
        });
      },
    },
    // auth secret
    secret: authSecret,
    baseURL: authUrl,
    // Enable Bearer token authentication for API requests using the bearer plugin
    plugins: [
      bearer(),
      // Set defaultRole to 'member' so new OAuth users get our app role instead of BA's default 'user'
      admin({ defaultRole: 'member' }),
      multiSession(),
    ],
    // Configure session settings
    session: {
      expiresIn: sessionExpiresIn, // 7 days default
      updateAge: 60 * 60 * 24, // 1 day
      // Store session token in cookie
      cookieCache: {
        enabled: true,
        maxAge: 300, // 5 minutes
      },
    },
    // Advanced configuration for better-auth
    advanced: {
      database: {
        // Generate UUID-format IDs for all entities (users, sessions, accounts, etc.)
        generateId: () => crypto.randomUUID(),
      },
      // Use default cookie configuration
      defaultCookieAttributes: {
        // UI and API are on different subdomains in production — requires 'none' for cross-origin cookies
        sameSite: cookieSecure ? 'none' : 'lax',
        secure: cookieSecure,
        path: '/',
      },
    },
    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {}),
      ...(microsoftClientId && microsoftClientSecret
        ? {
            microsoft: {
              clientId: microsoftClientId,
              clientSecret: microsoftClientSecret,
              tenantId: microsoftTenantId || 'common',
            },
          }
        : {}),
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      deleteUser: {
        enabled: true,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        // Automatically link accounts that share the same verified email
        trustedProviders: ['microsoft', 'google'],
      },
    },
  });
}
