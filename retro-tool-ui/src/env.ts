import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Supported application environments.
 * Set via VITE_APP_ENV in the corresponding .env file.
 */
export const APP_ENVS = [
  'local',
  'development',
  'staging',
  'production',
] as const
export type AppEnv = (typeof APP_ENVS)[number]

export const env = createEnv({
  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_APP_ENV: z
      .enum(APP_ENVS)
      .default('local')
      .describe('The current application environment'),
    VITE_API_URL: z.url(),
    VITE_CONVEX_URL: z.url().optional(),
    VITE_ESTIMATES_REALTIME_BACKEND: z
      .enum(['socket-io', 'convex'])
      .default('socket-io'),
    VITE_RETROS_REALTIME_BACKEND: z
      .enum(['socket-io', 'convex'])
      .default('socket-io'),
    VITE_ICEBREAKERS_REALTIME_BACKEND: z
      .enum(['socket-io', 'convex'])
      .default('socket-io'),
    VITE_STANDUPS_REALTIME_BACKEND: z
      .enum(['socket-io', 'convex'])
      .default('socket-io'),
    VITE_NOTIFICATIONS_REALTIME_BACKEND: z
      .enum(['socket-io', 'convex'])
      .default('socket-io'),
    // Polls and surveys are Convex-only (no Socket.IO backend), so they have no
    // per-feature backend flag — they use Convex whenever VITE_CONVEX_URL is set.
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: import.meta.env,

  /**
   * In order to solve empty-string issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})

// ── Convenience helpers ──────────────────────────────────────────────

/**
 * Returns true if the current environment is production.
 */
export const isProduction = env.VITE_APP_ENV === 'production'

/**
 * Returns true if the current environment is local or development.
 */
export const isDevelopment =
  env.VITE_APP_ENV === 'local' || env.VITE_APP_ENV === 'development'

/**
 * Returns true if the current environment is staging.
 */
export const isStaging = env.VITE_APP_ENV === 'staging'
