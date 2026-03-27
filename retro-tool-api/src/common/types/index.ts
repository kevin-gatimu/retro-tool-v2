/**
 * Common types shared across multiple services and controllers
 */

/**
 * Session user type used in controllers for authentication
 */
export type SessionUser = { user: { id: string } };

/**
 * Session shape used where current session token/id is also required
 */
export type SessionUserWithSession = {
  user: { id: string };
  session: { id: string; token: string };
};

/**
 * WebSocket session data cached for connection validation
 */
export type WsSessionData = { userId: string; expiresAt: string };

/**
 * WebSocket client data attached to socket instances
 */
export type ClientData = { userId?: string };

/**
 * Shared period type for reports filters
 */
export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';
