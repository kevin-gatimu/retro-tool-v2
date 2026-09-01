export const SESSION_UNAUTHORIZED_EVENT = 'retro-tool:session-unauthorized'
export const SESSION_ACTIVITY_STORAGE_KEY = 'retro_tool_session_activity'

export function getSessionActivityStorageKey(sessionId: string): string {
  return `${SESSION_ACTIVITY_STORAGE_KEY}:${sessionId}`
}
export const SESSION_LIFECYCLE_STORAGE_KEY = 'retro_tool_session_lifecycle'
export const SESSION_LIFECYCLE_CHANNEL = 'retro-tool-session-lifecycle'

export type SessionActivity = {
  sessionId: string
  lastActivityAt: number
}

export type SessionLifecycleMessage =
  | ({ type: 'activity' } & SessionActivity)
  | { type: 'logout'; sessionId: string; issuedAt: number }

export type SessionActivityState = 'active' | 'warning' | 'expired'

export function isSessionLifecycleMessage(
  value: unknown,
): value is SessionLifecycleMessage {
  if (!value || typeof value !== 'object') return false

  const message = value as Record<string, unknown>
  if (typeof message.sessionId !== 'string') return false
  if (message.type === 'logout') {
    return (
      typeof message.issuedAt === 'number' && Number.isFinite(message.issuedAt)
    )
  }

  return (
    message.type === 'activity' &&
    typeof message.lastActivityAt === 'number' &&
    Number.isFinite(message.lastActivityAt)
  )
}

export function getSessionActivityState(
  lastActivityAt: number,
  now: number,
  idleTimeoutMs: number,
  warningDurationMs: number,
): SessionActivityState {
  const idleFor = Math.max(0, now - lastActivityAt)
  if (idleFor >= idleTimeoutMs) return 'expired'
  if (idleFor >= idleTimeoutMs - warningDurationMs) return 'warning'
  return 'active'
}

export function readSessionActivity(sessionId: string): number | null {
  try {
    const value = window.localStorage.getItem(
      getSessionActivityStorageKey(sessionId),
    )
    if (!value) return null

    const activity = JSON.parse(value) as Partial<SessionActivity>
    if (
      activity.sessionId !== sessionId ||
      typeof activity.lastActivityAt !== 'number' ||
      !Number.isFinite(activity.lastActivityAt)
    ) {
      return null
    }

    return activity.lastActivityAt
  } catch {
    return null
  }
}

export function writeSessionActivity(activity: SessionActivity): void {
  try {
    window.localStorage.setItem(
      getSessionActivityStorageKey(activity.sessionId),
      JSON.stringify({ type: 'activity', ...activity }),
    )
  } catch {
    // In-memory tracking in the lifecycle manager remains available.
  }
}

export function clearSessionActivity(sessionId: string): void {
  try {
    window.localStorage.removeItem(getSessionActivityStorageKey(sessionId))
  } catch {
    // In-memory tracking is discarded when the lifecycle manager unmounts.
  }
}

export function publishSessionLifecycleMessage(
  message: SessionLifecycleMessage,
): void {
  try {
    window.localStorage.setItem(
      SESSION_LIFECYCLE_STORAGE_KEY,
      JSON.stringify(message),
    )
  } catch {
    // BroadcastChannel is the primary cross-tab transport when storage is blocked.
  }
}

export function notifySessionUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_UNAUTHORIZED_EVENT))
  }
}
