import { z } from 'zod';

export const SESSION_EXPIRES_IN_DEFAULT_SECONDS = 30 * 60;
export const SESSION_UPDATE_AGE_DEFAULT_SECONDS = 5 * 60;

/**
 * Rolling-session timings shared by the NestJS config factory and the
 * standalone Better Auth instance. Both read the same env vars, so the parsing
 * and the `updateAge < expiresIn` rule live here rather than in either caller.
 */
const sessionTimingSchema = z
  .object({
    sessionExpiresIn: z
      .number()
      .int()
      .positive()
      .default(SESSION_EXPIRES_IN_DEFAULT_SECONDS),
    sessionUpdateAge: z
      .number()
      .int()
      .positive()
      .default(SESSION_UPDATE_AGE_DEFAULT_SECONDS),
  })
  .refine((timing) => timing.sessionUpdateAge < timing.sessionExpiresIn, {
    message: 'Session update age must be shorter than session expiration',
    path: ['sessionUpdateAge'],
  });

export type SessionTiming = z.infer<typeof sessionTimingSchema>;

/**
 * `Number` rather than `parseInt` on purpose: `parseInt('30m', 10)` silently
 * yields 30, while `Number('30m')` is NaN and fails validation below.
 */
function parseSeconds(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  return Number(raw);
}

export function readSessionTiming(
  env: NodeJS.ProcessEnv = process.env,
): SessionTiming {
  return sessionTimingSchema.parse({
    sessionExpiresIn: parseSeconds(env.BETTER_AUTH_SESSION_EXPIRES_IN),
    sessionUpdateAge: parseSeconds(env.BETTER_AUTH_SESSION_UPDATE_AGE),
  });
}
