import { describe, expect, it, vi } from 'vitest'
import { isStorageAvailable } from './browser-storage'

describe('isStorageAvailable', () => {
  it('reports available storage without inferring browsing mode', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(isStorageAvailable(storage)).toBe(true)
    expect(values.size).toBe(0)
  })

  it('reports unavailable storage when writes are blocked', () => {
    const storage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('Blocked')
      }),
    }

    expect(isStorageAvailable(storage)).toBe(false)
  })
})
