import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@thallesp/nestjs-better-auth';
import type { Config } from '../config/configuration';
import type { Auth } from './auth.config';
import type { JwtAlignmentResult } from './types';

/**
 * Convex's `customJwt` verifier accepts only RS256/ES256 (not the plugin's
 * EdDSA default). A JWKS advertising any other algorithm means every token is
 * silently rejected on the Convex side — treat it as a misalignment.
 */
const CONVEX_SUPPORTED_ALGS = new Set(['RS256', 'ES256']);

/** Narrow the loosely-typed JWKS endpoint response to the keys we inspect. */
function extractJwksKeys(jwks: unknown): Array<{ alg?: string; kid?: string }> {
  if (
    typeof jwks === 'object' &&
    jwks !== null &&
    'keys' in jwks &&
    Array.isArray((jwks as { keys?: unknown }).keys)
  ) {
    return (jwks as { keys: Array<{ alg?: string; kid?: string }> }).keys;
  }
  return [];
}

/**
 * Health guardrail that verifies the JWT the API mints stays aligned with the
 * JWKS Convex verifies against. A byte-mismatched issuer/audience or an
 * unreachable/empty JWKS silently disables *all* authenticated Convex reads;
 * this surfaces that as an explicit readiness signal instead.
 *
 * The check never throws — every failure path is translated into a status
 * field so the health handler stays safe — and it never blocks app boot.
 */
@Injectable()
export class JwtAlignmentService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JwtAlignmentService.name);

  constructor(
    private readonly authService: AuthService<Auth>,
    private readonly configService: ConfigService<Config>,
  ) {}

  /**
   * Run the check once at startup and log the outcome so ops sees a byte
   * mismatch or unreachable JWKS the moment the process comes up. Fired
   * without awaiting so it never blocks boot.
   */
  onApplicationBootstrap(): void {
    void this.check().then((result) => {
      if (result.status === 'ok') {
        this.logger.log(
          `JWT/JWKS alignment ok (issuer=${result.issuer}, audience=${result.audience}, keys=${result.keyCount})`,
        );
      } else {
        this.logger.warn(
          `JWT/JWKS alignment ${result.status}: ${result.detail} ` +
            `(issuer=${result.issuer}, audience=${result.audience})`,
        );
      }
    });
  }

  /**
   * Resolve the effective JWT issuer exactly as `auth.config.ts` does, so the
   * guardrail validates the same value the plugin actually stamps on tokens.
   */
  private resolveIssuer(): string {
    const authConfig = this.configService.get('auth', { infer: true });
    const port = this.configService.get('port', { infer: true }) ?? 8000;
    const authUrl = authConfig?.url || `http://localhost:${port}`;
    return authConfig?.jwtIssuer || authUrl;
  }

  private resolveAudience(): string {
    return (
      this.configService.get('auth.jwtAudience', { infer: true }) ?? 'convex'
    );
  }

  /**
   * Verify JWT ↔ JWKS alignment. Guaranteed not to throw: every failure is
   * mapped to a `misaligned` / `unreachable` status.
   */
  async check(): Promise<JwtAlignmentResult> {
    const issuer = this.resolveIssuer();
    const audience = this.resolveAudience();

    // Config consistency: Convex matches `iss` byte-for-byte against a value it
    // resolves from the JWKS origin, and `aud` against its applicationID. An
    // empty issuer/audience (or a non-URL issuer) can never line up.
    if (!issuer || !audience) {
      return {
        status: 'misaligned',
        detail: `JWT config incomplete (issuer=${issuer || '<empty>'}, audience=${audience || '<empty>'})`,
        issuer,
        audience,
        keyCount: 0,
      };
    }
    try {
      new URL(issuer);
    } catch {
      return {
        status: 'misaligned',
        detail: `JWT issuer is not a valid absolute URL: ${issuer}`,
        issuer,
        audience,
        keyCount: 0,
      };
    }

    let keys: Array<{ alg?: string; kid?: string }>;
    try {
      const jwks = await this.authService.api.getJwks();
      keys = extractJwksKeys(jwks);
    } catch (error) {
      return {
        status: 'unreachable',
        detail: `JWKS endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
        issuer,
        audience,
        keyCount: 0,
      };
    }

    if (keys.length === 0) {
      return {
        status: 'unreachable',
        detail: 'JWKS returned no keys; Convex cannot verify any token',
        issuer,
        audience,
        keyCount: 0,
      };
    }

    // Every advertised key must use an algorithm Convex can verify, otherwise
    // Convex rejects every token minted with it.
    const unsupported = keys.filter(
      (key) => !key.alg || !CONVEX_SUPPORTED_ALGS.has(key.alg),
    );
    if (unsupported.length > 0) {
      const algs = unsupported.map((key) => key.alg ?? '<none>').join(', ');
      return {
        status: 'misaligned',
        detail: `JWKS advertises algorithm(s) Convex cannot verify (${algs}); expected one of ${[...CONVEX_SUPPORTED_ALGS].join('/')}`,
        issuer,
        audience,
        keyCount: keys.length,
      };
    }

    return { status: 'ok', issuer, audience, keyCount: keys.length };
  }
}
