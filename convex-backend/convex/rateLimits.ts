import { RateLimiter, SECOND, MINUTE } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'

/**
 * Central rate-limiter instance.
 *
 * Limits protect against runaway NestJS projection sync bugs and
 * (after auth is enforced) against client-side subscription spam.
 *
 * All limits are keyed by the primary entity ID so unrelated entities
 * don't interfere with each other.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /**
   * Retro board snapshot upserts — keyed by retroId.
   * Normal sync cadence is ≤3/sec per retro; allow short bursts.
   */
  retroBoardUpsert: {
    kind: 'token bucket',
    rate: 10,
    period: SECOND,
    capacity: 20,
    shards: 2,
  },

  /**
   * Estimate board snapshot upserts — keyed by sessionId.
   */
  estimateBoardUpsert: {
    kind: 'token bucket',
    rate: 10,
    period: SECOND,
    capacity: 20,
    shards: 2,
  },

  /**
   * Notification upserts — keyed by userId.
   * Notifications are low-frequency; a strict fixed window is fine.
   */
  notificationUpsert: {
    kind: 'fixed window',
    rate: 50,
    period: MINUTE,
  },
})
