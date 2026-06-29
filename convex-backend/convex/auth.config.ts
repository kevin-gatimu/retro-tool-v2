import type { AuthConfig } from 'convex/server'

// Verifies RS256 JWTs minted by the external NestJS Better Auth server. Convex's
// customJwt verifier supports only RS256/ES256 (not EdDSA), and takes the JWKS
// URL directly (no OIDC discovery doc needed). issuer/jwks/audience are provided
// per-environment via Convex env vars and must match the API's emitted token
// (`iss`/`aud`) byte-for-byte. After this, ctx.auth.getUserIdentity() resolves
// the caller; identity.subject === the Better Auth user id stored in projections.
const authConfig: AuthConfig = {
  providers: [
    {
      type: 'customJwt',
      applicationID: process.env.JWT_AUDIENCE ?? 'convex',
      issuer: process.env.JWT_ISSUER ?? '',
      jwks: process.env.JWT_JWKS_URL ?? '',
      algorithm: 'RS256',
    },
  ],
}

export default authConfig