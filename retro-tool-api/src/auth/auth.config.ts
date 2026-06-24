import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, emailOTP, multiSession } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Config } from '../config/configuration';
import { createEmailService } from '../lib/email';
import { orgInvitation } from '../organizations/schema';
import { teamInvitation } from '../teams/schema';
import * as schema from './schema';

/**
 * Concrete type of our configured Better Auth instance (including plugins like
 * emailOTP). Used to parametrize the library's `AuthService<Auth>` so the
 * plugin's `api.*` methods are visible to TypeScript.
 */
export type Auth = ReturnType<typeof createAuth>;

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
    frontendUrl ?? 'http://localhost:3000',
  );

  // Get auth config object for nested properties
  const authConfig = configService.get('auth', { infer: true });
  const microsoftClientId = authConfig?.microsoft?.clientId;
  const microsoftClientSecret = authConfig?.microsoft?.clientSecret;

  // WebAuthn relying-party identity. rpID/origin must match the UI domain (UI
  // and API deploy separately), so derive the origin from frontend.url and the
  // rpID from config (defaulted from FRONTEND_URL's hostname in configuration.ts).
  const passkeyRpId = authConfig?.rpId ?? 'localhost';
  const passkeyRpName = authConfig?.rpName ?? 'Retro-Tool';
  const passkeyOrigin =
    frontendUrl?.replace(/\/$/, '') ?? 'http://localhost:3000';

  // Create database pool and drizzle instance using ConfigService
  // Check if this is an Azure PostgreSQL connection
  const isAzurePostgres =
    databaseUrl?.includes('.postgres.database.azure.com') || false;

  // Normalize DATABASE_URL for node-postgres to avoid sslmode deprecation
  // warnings from pg-connection-string while keeping SSL handling explicit.
  const normalizedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
  normalizedDatabaseUrl?.searchParams.delete('sslmode');

  const pool = new Pool({
    connectionString: normalizedDatabaseUrl?.toString() ?? databaseUrl,
    ssl: isAzurePostgres ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  // Get allowed origins from config
  const allowedOrigins = configService.get('allowedOrigins', { infer: true })!;

  // Use BETTER_AUTH_URL if set (required for production); fall back to localhost for local dev
  const authUrl = authConfig?.url || `http://localhost:${port}`;

  // Whether an active (unaccepted, unexpired) org/team invitation exists for an
  // email — used to suppress the standalone email-verification message, since
  // accepting the invite verifies the email anyway.
  const hasActiveInvitation = async (email: string): Promise<boolean> => {
    const now = new Date();
    const lowered = email.toLowerCase();
    const [orgInv] = await db
      .select({ id: orgInvitation.id })
      .from(orgInvitation)
      .where(
        and(
          eq(sql`lower(${orgInvitation.email})`, lowered),
          isNull(orgInvitation.acceptedAt),
          gt(orgInvitation.expiresAt, now),
        ),
      )
      .limit(1);
    if (orgInv) return true;

    const [teamInv] = await db
      .select({ id: teamInvitation.id })
      .from(teamInvitation)
      .where(
        and(
          eq(sql`lower(${teamInvitation.email})`, lowered),
          isNull(teamInvitation.acceptedAt),
          gt(teamInvitation.expiresAt, now),
        ),
      )
      .limit(1);
    return Boolean(teamInv);
  };

  return betterAuth({
    // Per-IP rate limiting (in-memory, uses x-forwarded-for via advanced.ipAddress config)
    rateLimit: {
      enabled: true,
      window: 60, // default: 100 requests per 60s for all routes
      max: 100,
      customRules: {
        '/sign-up/email': { window: 300, max: 5 }, // 5 signup attempts per 5 min
        '/sign-in/email': { window: 60, max: 10 }, // 10 login attempts per min
        '/forgot-password': { window: 300, max: 3 }, // 3 resets per 5 min
        // Email-OTP routes (defense-in-depth on top of allowedAttempts:3)
        '/email-otp/send-verification-otp': { window: 300, max: 5 }, // 5 code sends / 5 min
        '/sign-in/email-otp': { window: 60, max: 10 }, // 10 OTP sign-in tries / min
        '/email-otp/verify-email': { window: 60, max: 10 },
        '/email-otp/request-password-reset': { window: 300, max: 3 },
        '/email-otp/reset-password': { window: 300, max: 10 },
      },
    },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        passkey: schema.passkey,
      },
    }),
    // Allow configured origins for Swagger UI and frontend
    trustedOrigins: allowedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      // Password reset tokens expire 20 minutes after issuance
      resetPasswordTokenExpiresIn: 60 * 20,
      sendResetPassword: async ({
        user,
        token,
      }: {
        user: { email: string; name: string };
        token: string;
      }) => {
        const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;
        console.log(
          `[Auth] sendResetPassword fired for ${user.email} -> ${resetUrl}`,
        );
        try {
          await emailService.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl,
          });
        } catch (err) {
          console.error('[Auth] sendResetPassword failed:', err);
          throw err;
        }
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
        // Suppress the standalone "verify your email" message when an active
        // (unaccepted, unexpired) invitation already exists for this address —
        // accepting that invite will mark the email as verified, so the
        // duplicate verification email would only confuse the recipient.
        if (await hasActiveInvitation(user.email)) return;

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
      // Email OTP for passwordless sign-in, email verification, and password
      // reset (6-digit code, 5-min expiry, 3 attempts). Sends are triggered
      // server-side; the UI calls our /api/otp/* endpoints which proxy to the
      // injected auth.api.* methods.
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          // We don't use the change-email OTP flow; ignore that type.
          if (type === 'change-email') return;
          // Suppress the standalone verification code when an active org/team
          // invitation already exists (accepting it verifies the email anyway).
          if (
            type === 'email-verification' &&
            (await hasActiveInvitation(email))
          ) {
            return;
          }
          // Fire-and-forget (plugin guidance: don't await, avoid timing attacks).
          void emailService
            .sendOtpEmail({ to: email, name: email, otp, type })
            .catch((err) => {
              console.error(`[Auth] sendOtpEmail (${type}) failed:`, err);
            });
        },
      }),
      // WebAuthn passkeys for passwordless sign-in. rpID/origin are bound to the
      // UI domain; the plugin auto-mounts /sign-in/passkey and /passkey/* under
      // /api/auth and owns the `passkey` table.
      passkey({
        rpID: passkeyRpId,
        rpName: passkeyRpName,
        origin: passkeyOrigin,
      }),
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
      ipAddress: {
        // Azure App Service sits behind a reverse proxy, so client IP is provided
        // via forwarded headers instead of the direct socket address.
        ipAddressHeaders: [
          'x-forwarded-for',
          'x-client-ip',
          'x-real-ip',
          'cf-connecting-ip',
        ],
        trustedProxyHeaders: true,
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
      ...(microsoftClientId && microsoftClientSecret
        ? {
            microsoft: {
              clientId: microsoftClientId,
              clientSecret: microsoftClientSecret,
              tenantId: 'common',
              authority: 'https://login.microsoftonline.com',
              prompt: 'select_account',
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
        trustedProviders: ['microsoft'],
      },
    },
  });
}
