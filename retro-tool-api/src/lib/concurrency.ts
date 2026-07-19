/**
 * Run `worker` over `items` with at most `limit` in flight at once. Resolves
 * when all complete. Individual rejections are the worker's responsibility —
 * this helper does not catch them, so pass a worker that handles its own
 * errors when you need it to never reject.
 *
 * Used to bound the projection outbox's per-row delivery fan-out against the
 * single Convex worker instead of running strictly one-at-a-time.
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
}
