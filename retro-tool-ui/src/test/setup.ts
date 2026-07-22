import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests so DOM state doesn't leak across cases.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement these browser APIs that Radix/shadcn primitives and
// some hooks call on mount. Assign stubs so component smoke tests can render.
// (The DOM lib types them as always-present, so we assign unconditionally
// rather than guard — under jsdom they are undefined at runtime.)
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: ReadonlyArray<number> = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver
globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver
