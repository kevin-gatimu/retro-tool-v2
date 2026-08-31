import { describe, expect, it, vi } from 'vitest'
import { BulkMutationError, runBulkMutation } from './bulk-mutation'

describe('runBulkMutation', () => {
  it('waits for every operation and returns an accurate summary', async () => {
    const operations = [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ]

    await expect(runBulkMutation(operations)).resolves.toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
    })
    expect(
      operations.every((operation) => operation.mock.calls.length === 1),
    ).toBe(true)
  })

  it('reports partial success only after every operation settles', async () => {
    const completed: string[] = []
    const operations = [
      vi.fn().mockImplementation(async () => {
        completed.push('success')
      }),
      vi.fn().mockRejectedValue(new Error('failed request')),
    ]

    const error = await runBulkMutation(operations).catch(
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(BulkMutationError)
    expect((error as BulkMutationError).summary).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
    })
    expect(completed).toEqual(['success'])
    expect(
      operations.every((operation) => operation.mock.calls.length === 1),
    ).toBe(true)
  })
})
