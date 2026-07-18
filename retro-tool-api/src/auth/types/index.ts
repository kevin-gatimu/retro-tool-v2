/**
 * Result of the JWT ↔ JWKS alignment guardrail (see `jwt-alignment.service.ts`).
 *
 * - `ok`          — JWKS is reachable, non-empty, every key uses a
 *                   Convex-verifiable algorithm, and issuer/audience are set.
 * - `misaligned`  — a locally-detectable contract breach (empty/invalid issuer
 *                   or audience, or a signing key whose `alg` Convex cannot
 *                   verify). Convex would silently reject every token.
 * - `unreachable` — the JWKS endpoint threw or returned no keys, so Convex has
 *                   nothing to verify authenticated reads against.
 */
export type JwtAlignmentStatus = 'ok' | 'misaligned' | 'unreachable';

export interface JwtAlignmentResult {
  status: JwtAlignmentStatus;
  /** Human-readable reason, present only when status !== 'ok'. */
  detail?: string;
  /** Effective issuer resolved exactly as auth.config.ts computes it. */
  issuer: string;
  /** Effective audience (`aud`) the plugin stamps onto tokens. */
  audience: string;
  /** Number of keys the JWKS endpoint returned. */
  keyCount: number;
}
