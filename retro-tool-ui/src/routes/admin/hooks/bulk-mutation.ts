export interface BulkMutationSummary {
  total: number
  succeeded: number
  failed: number
}

export class BulkMutationError extends Error {
  constructor(readonly summary: BulkMutationSummary) {
    super(
      `${summary.failed} of ${summary.total} operations failed (${summary.succeeded} succeeded)`,
    )
    this.name = 'BulkMutationError'
  }
}

export async function runBulkMutation(
  operations: ReadonlyArray<() => Promise<unknown>>,
): Promise<BulkMutationSummary> {
  const results = await Promise.allSettled(
    operations.map((operation) => operation()),
  )
  const failed = results.filter((result) => result.status === 'rejected').length
  const summary = {
    total: results.length,
    succeeded: results.length - failed,
    failed,
  }

  if (failed > 0) {
    throw new BulkMutationError(summary)
  }

  return summary
}
