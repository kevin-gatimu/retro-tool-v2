import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from './api'
import { SESSION_UNAUTHORIZED_EVENT } from './session-lifecycle'

describe('api session handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('notifies the session manager when an API request is unauthorized', async () => {
    const listener = vi.fn()
    const response = new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, listener)

    await expect(api.get('/api/private')).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 401,
        message: 'Unauthorized',
      }),
    )
    expect(listener).toHaveBeenCalledOnce()

    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, listener)
  })

  it('does not notify for non-authentication errors', async () => {
    const listener = vi.fn()
    const response = new Response(JSON.stringify({ message: 'Unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, listener)

    await expect(api.get('/api/private')).rejects.toBeInstanceOf(ApiError)
    expect(listener).not.toHaveBeenCalled()

    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, listener)
  })
})
