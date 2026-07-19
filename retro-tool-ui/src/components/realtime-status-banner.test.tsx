// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeStatusBanner } from './realtime-status-banner'

// Mock the Convex auth hook so we can drive isAuthenticated without a client.
const useConvexAuthMock = vi.fn<() => { isAuthenticated: boolean }>()
vi.mock('convex/react', () => ({
  useConvexAuth: () => useConvexAuthMock(),
}))

const BANNER_TEXT = /live updates paused/i

describe('RealtimeStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useConvexAuthMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when not in Convex mode (active=false)', () => {
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false })
    render(<RealtimeStatusBanner active={false} />)
    expect(screen.queryByText(BANNER_TEXT)).toBeNull()
  })

  it('renders nothing while Convex is authenticated (healthy)', () => {
    useConvexAuthMock.mockReturnValue({ isAuthenticated: true })
    render(<RealtimeStatusBanner active />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.queryByText(BANNER_TEXT)).toBeNull()
  })

  it('does not flash on a brief disconnect that resolves inside the debounce', () => {
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false })
    const { rerender } = render(<RealtimeStatusBanner active />)

    // Advance less than the debounce window — banner must stay hidden.
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.queryByText(BANNER_TEXT)).toBeNull()

    // Reconnect before the debounce elapses — banner never shows.
    useConvexAuthMock.mockReturnValue({ isAuthenticated: true })
    rerender(<RealtimeStatusBanner active />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.queryByText(BANNER_TEXT)).toBeNull()
  })

  it('shows the banner once the disconnected state persists past the debounce', () => {
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false })
    render(<RealtimeStatusBanner active />)

    expect(screen.queryByText(BANNER_TEXT)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(3_000)
    })

    const banner = screen.getByRole('status')
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy()
  })

  it('hides immediately on reconnect after the banner has shown', () => {
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false })
    const { rerender } = render(<RealtimeStatusBanner active />)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy()

    useConvexAuthMock.mockReturnValue({ isAuthenticated: true })
    rerender(<RealtimeStatusBanner active />)
    // No timer advance — recovery is instant.
    expect(screen.queryByText(BANNER_TEXT)).toBeNull()
  })
})
