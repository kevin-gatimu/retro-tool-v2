import { sql } from 'drizzle-orm';
import type { AnyColumn, SQL } from 'drizzle-orm';
import type { ReportBucket } from '../types';

/**
 * `date_trunc` bucket key formatted as YYYY-MM-DD, matching `truncateDate`
 * below so SQL buckets and JS gap-filling agree.
 *
 * The bucket is inlined as a raw SQL literal rather than a bound parameter:
 * Postgres can't infer the type of a `$n` placeholder in `date_trunc($n, …)`
 * ("could not determine data type of parameter"), which surfaced as a 500 on
 * every report endpoint. `bucket` is a closed enum (`day`/`week`/`month`), so
 * it's validated against that set before being embedded — never user text.
 */
export function bucketExpr(
  bucket: ReportBucket,
  column: AnyColumn,
): SQL<string> {
  const field: ReportBucket =
    bucket === 'day' || bucket === 'week' || bucket === 'month'
      ? bucket
      : 'day';
  return sql<string>`to_char(date_trunc(${sql.raw(`'${field}'`)}, ${column}), 'YYYY-MM-DD')`;
}

/** JS twin of Postgres `date_trunc` (UTC; weeks start Monday). */
export function truncateDate(date: Date, bucket: ReportBucket): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (bucket === 'week') {
    const day = d.getUTCDay(); // 0 = Sunday
    const diff = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - diff);
  } else if (bucket === 'month') {
    d.setUTCDate(1);
  }
  return d.toISOString().slice(0, 10);
}

/** All bucket keys covering [from, to] inclusive, in order. */
export function bucketKeys(
  from: Date,
  to: Date,
  bucket: ReportBucket,
): string[] {
  const keys: string[] = [];
  const cursor = new Date(truncateDate(from, bucket));
  const last = truncateDate(to, bucket);
  // Hard ceiling keeps a hostile/buggy range from generating unbounded keys.
  for (let i = 0; i < 1000; i++) {
    const key = cursor.toISOString().slice(0, 10);
    keys.push(key);
    if (key === last) break;
    if (bucket === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/**
 * Gap-fills a series: every bucket in range appears exactly once, missing
 * buckets get the zero-value produced by `zero(bucketKey)`.
 */
export function fillSeries<T extends { bucket: string }>(
  from: Date,
  to: Date,
  bucket: ReportBucket,
  rows: T[],
  zero: (bucketKey: string) => T,
): T[] {
  const byKey = new Map(rows.map((row) => [row.bucket, row]));
  return bucketKeys(from, to, bucket).map((key) => byKey.get(key) ?? zero(key));
}

export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal, %
}
