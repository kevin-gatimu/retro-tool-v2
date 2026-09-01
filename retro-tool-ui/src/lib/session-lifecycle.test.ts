import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSessionActivity,
  getSessionActivityState,
  getSessionActivityStorageKey,
  isSessionLifecycleMessage,
  notifySessionUnauthorized,
  readSessionActivity,
  SESSION_UNAUTHORIZED_EVENT,
  writeSessionActivity,
} from './session-lifecycle'

const storedValues = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return storedValues.size
  },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => storedValues.delete(key),
  setItem: (key, value) => storedValues.set(key, value),
}

describe('session lifecycle', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })
  })

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('derives active, warning, and expired states from inactivity', () => {
    const timeout = 30 * 60_000
    const warning = 2 * 60_000

    expect(
      getSessionActivityState(0, timeout - warning - 1, timeout, warning),
    ).toBe('active')
    expect(
      getSessionActivityState(0, timeout - warning, timeout, warning),
    ).toBe('warning')
    expect(getSessionActivityState(0, timeout, timeout, warning)).toBe(
      'expired',
    )
  })

  it('does not expire when the system clock moves backwards', () => {
    expect(getSessionActivityState(2_000, 1_000, 30_000, 2_000)).toBe('active')
  })

  it('keeps activity isolated by Better Auth session id', () => {
    writeSessionActivity({ sessionId: 'session-a', lastActivityAt: 123 })

    writeSessionActivity({ sessionId: 'session-b', lastActivityAt: 456 })

    expect(readSessionActivity('session-a')).toBe(123)
    expect(readSessionActivity('session-b')).toBe(456)

    clearSessionActivity('session-b')
    expect(readSessionActivity('session-b')).toBeNull()
    expect(readSessionActivity('session-a')).toBe(123)

    clearSessionActivity('session-a')
    expect(readSessionActivity('session-a')).toBeNull()
  })

  it('ignores malformed stored activity', () => {
    window.localStorage.setItem(
      getSessionActivityStorageKey('session-a'),
      '{not-json',
    )

    expect(readSessionActivity('session-a')).toBeNull()
  })

  it('rejects malformed cross-tab lifecycle messages', () => {
    expect(isSessionLifecycleMessage(null)).toBe(false)
    expect(
      isSessionLifecycleMessage({ type: 'activity', sessionId: 'a' }),
    ).toBe(false)
    expect(
      isSessionLifecycleMessage({
        type: 'activity',
        sessionId: 'a',
        lastActivityAt: 123,
      }),
    ).toBe(true)
  })

  it('publishes a centralized unauthorized event', () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, listener)

    notifySessionUnauthorized()

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, listener)
  })
})
