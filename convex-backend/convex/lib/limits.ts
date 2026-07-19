/**
 * Read-side protection for client-callable queries (SECURITY-ASSESSMENT F9).
 *
 * Convex queries are read-only, so they cannot consume tokens from the
 * `@convex-dev/rate-limiter` component (token consumption is a write) — the
 * limiter protects the mutation side only. What bounds the query side:
 *
 *  - every query derives the caller via `requireIdentity` (no anonymous reads),
 *  - identical query+args subscriptions are served from Convex's cache,
 *  - argument validators reject unbounded/malformed input, and
 *  - list projections cap their result size with `LIST_PROJECTION_CAP` below,
 *    so a full-table `.collect()` over the active-session projections can
 *    never fan out an unbounded payload to a single subscriber.
 *
 * The projection tables only hold *active* collaboration snapshots (the
 * reconciliation cron prunes stale rows), so the cap is a defensive backstop,
 * not a pagination mechanism — the REST API remains the source of truth for
 * full lists.
 */
export const LIST_PROJECTION_CAP = 500

/**
 * Max presence rows read per session. Presence is one row per participant, so a
 * real session never approaches this — the cap just keeps the subscribed read
 * bounded (per the Convex guidelines' "never unbounded .collect()" rule) so a
 * runaway row count can't bloat the reactive read-set or blow the per-query
 * document limit.
 */
export const MAX_PRESENCE_PER_SESSION = 200
