import { Agent, setGlobalDispatcher } from 'undici';

/**
 * Bounded keep-alive HTTP dispatcher for all server-side `fetch` (Node's global
 * fetch is undici under the hood).
 *
 * Why: the projection-sync services POST many mutations to the single Convex
 * backend — on a busy board, one user action fans out N per-member board
 * upserts. Node's default undici agent keeps connections alive but leaves the
 * per-origin connection count **unbounded**, so a burst opens unbounded sockets
 * to the one Convex host (risking backend overload + local socket exhaustion),
 * and a fresh connection pays ~3 RTTs of TCP+TLS handshake before the first
 * byte. A shared, bounded, keep-alive pool caps concurrent sockets per origin
 * and reuses warm connections across the fan-out.
 *
 * This sets the process-wide default dispatcher, so every `fetch` benefits with
 * no per-call-site change. Convex is by far the highest-volume server→server
 * caller; Resend/web-push/OAuth traffic is low-volume and equally fine pooled.
 */

/** Max concurrent connections undici keeps open per origin. */
const CONNECTIONS_PER_ORIGIN = 24;
/** Keep idle sockets warm (ms) so bursts reuse them instead of reconnecting. */
const KEEP_ALIVE_TIMEOUT_MS = 60_000;

let configured = false;

/**
 * Install the bounded keep-alive dispatcher as the process default. Idempotent
 * — safe to call once at bootstrap. Returns the configured limits for logging.
 */
export function configureHttpDispatcher(): {
  connectionsPerOrigin: number;
  keepAliveTimeoutMs: number;
} {
  if (!configured) {
    setGlobalDispatcher(
      new Agent({
        connections: CONNECTIONS_PER_ORIGIN,
        keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
        // Allow the server to extend keep-alive up to this ceiling.
        keepAliveMaxTimeout: KEEP_ALIVE_TIMEOUT_MS,
      }),
    );
    configured = true;
  }
  return {
    connectionsPerOrigin: CONNECTIONS_PER_ORIGIN,
    keepAliveTimeoutMs: KEEP_ALIVE_TIMEOUT_MS,
  };
}
