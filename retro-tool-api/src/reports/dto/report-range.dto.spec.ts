import { leagueQuerySchema, reportRangeSchema, resolveRange } from './index';

describe('reportRangeSchema', () => {
  it('accepts an empty query (all defaults)', () => {
    expect(reportRangeSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a period preset', () => {
    const result = reportRangeSchema.safeParse({ period: 'month' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown period', () => {
    expect(reportRangeSchema.safeParse({ period: 'decade' }).success).toBe(
      false,
    );
  });

  it('rejects from > to', () => {
    const result = reportRangeSchema.safeParse({
      from: '2026-07-10',
      to: '2026-07-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown bucket', () => {
    expect(reportRangeSchema.safeParse({ bucket: 'hour' }).success).toBe(false);
  });
});

describe('resolveRange', () => {
  it('defaults to a quarter with week buckets', () => {
    const range = resolveRange({});
    expect(range.bucket).toBe('week');
    const spanDays =
      (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(90);
  });

  it('uses day buckets for the week preset', () => {
    expect(resolveRange({ period: 'week' }).bucket).toBe('day');
  });

  it('uses month buckets for the year preset', () => {
    expect(resolveRange({ period: 'year' }).bucket).toBe('month');
  });

  it('derives day buckets for short explicit ranges', () => {
    const range = resolveRange({
      from: new Date('2026-07-01'),
      to: new Date('2026-07-15'),
    });
    expect(range.bucket).toBe('day');
    expect(range.asRange.from.startsWith('2026-07-01')).toBe(true);
  });

  it('respects an explicit bucket', () => {
    expect(resolveRange({ period: 'week', bucket: 'month' }).bucket).toBe(
      'month',
    );
  });
});

describe('leagueQuerySchema', () => {
  it('defaults page and pageSize', () => {
    const result = leagueQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('coerces string pagination values', () => {
    const result = leagueQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('caps pageSize at 100', () => {
    expect(leagueQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });

  it('rejects an over-long search string', () => {
    expect(
      leagueQuerySchema.safeParse({ search: 'x'.repeat(101) }).success,
    ).toBe(false);
  });
});
