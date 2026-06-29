import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import type { Socket } from 'socket.io';
import type { Auth } from './auth.config';

/**
 * Authenticates a Socket.IO handshake via Better Auth, accepting **either** a
 * bearer token (`handshake.auth.token`, preferred) **or** the session cookie
 * (fallback during the cookie→bearer rollout).
 *
 * Both are forwarded to `auth.api.getSession`, which the `bearer()` plugin makes
 * validate uniformly (it converts an `Authorization: Bearer` header into the
 * session cookie internally) and which enforces session expiry. This replaces
 * the per-gateway cookie-regex + raw `session`-table lookups.
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(private readonly authService: AuthService<Auth>) {}

  /**
   * Resolve the authenticated user id for a connecting socket, or `null` if the
   * handshake carries no valid token/cookie. Callers should `client.disconnect()`
   * on `null`.
   */
  async authenticate(client: Socket): Promise<string | null> {
    try {
      const headers = new Headers();

      const token =
        typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Cookie fallback during rollout: forward the handshake cookie so existing
      // cookie-only clients keep working until the UI sends tokens everywhere.
      const cookie = client.handshake.headers.cookie;
      if (cookie) {
        headers.set('cookie', cookie);
      }

      const session = await this.authService.api.getSession({ headers });
      return session?.user?.id ?? null;
    } catch (error) {
      this.logger.error(
        'WS authentication failed',
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
