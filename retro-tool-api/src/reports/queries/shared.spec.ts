import { bucketKeys, fillSeries, ratio, truncateDate } from './shared';

describe('truncateDate', () => {
  it('truncates days to themselves', () => {
    expect(truncateDate(new Date('2026-07-16T15:30:00Z'), 'day')).toBe(
      '2026-07-16',
    );
  });

  it('truncates weeks to Monday (matching Postgres date_trunc)', () => {
    // 2026-07-16 is a Thursday; the ISO week starts Monday 2026-07-13.
    expect(truncateDate(new Date('2026-07-16T00:00:00Z'), 'week')).toBe(
      '2026-07-13',
    );
    // A Sunday belongs to the week starting the previous Monday.
    expect(truncateDate(new Date('2026-07-19T00:00:00Z'), 'week')).toBe(
      '2026-07-13',
    );
  });

  it('truncates months to the first', () => {
    expect(truncateDate(new Date('2026-07-16T00:00:00Z'), 'month')).toBe(
      '2026-07-01',
    );
  });
});

describe('bucketKeys', () => {
  it('covers the range inclusively by day', () => {
    const keys = bucketKeys(
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-03T12:00:00Z'),
      'day',
    );
    expect(keys).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('steps months across year boundaries', () => {
    const keys = bucketKeys(
      new Date('2025-11-15T00:00:00Z'),
      new Date('2026-01-15T00:00:00Z'),
      'month',
    );
    expect(keys).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
  });
});

describe('fillSeries', () => {
  it('gap-fills missing buckets with the zero value', () => {
    const rows = [{ bucket: '2026-07-02', value: 5 }];
    const filled = fillSeries(
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-07-03T00:00:00Z'),
      'day',
      rows,
      (bucket) => ({ bucket, value: 0 }),
    );
    expect(filled).toEqual([
      { bucket: '2026-07-01', value: 0 },
      { bucket: '2026-07-02', value: 5 },
      { bucket: '2026-07-03', value: 0 },
    ]);
  });
});

describe('ratio', () => {
  it('returns a one-decimal percentage', () => {
    expect(ratio(1, 3)).toBe(33.3);
  });

  it('returns 0 for a zero denominator', () => {
    expect(ratio(5, 0)).toBe(0);
  });
});
