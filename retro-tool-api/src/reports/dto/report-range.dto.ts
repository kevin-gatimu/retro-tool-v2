import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ReportBucket, ReportRange } from '../types';

const BUCKETS = ['day', 'week', 'month'] as const;
const PERIODS = ['week', 'month', 'quarter', 'year'] as const;

/**
 * Shared range query for every v2 report endpoint.
 * `period` is sugar for `from/to`; explicit dates win when both are sent.
 */
export const reportRangeSchema = z
  .object({
    period: z.enum(PERIODS).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    bucket: z.enum(BUCKETS).optional(),
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, {
    message: '`from` must not be after `to`',
  });

export type ReportRangeDto = z.infer<typeof reportRangeSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS: Record<(typeof PERIODS)[number], number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const DEFAULT_BUCKET: Record<(typeof PERIODS)[number], ReportBucket> = {
  week: 'day',
  month: 'day',
  quarter: 'week',
  year: 'month',
};

export interface ResolvedRange {
  from: Date;
  to: Date;
  bucket: ReportBucket;
  asRange: ReportRange;
}

/** Picks a series bucket from an explicit date span. */
function deriveBucket(spanDays: number): ReportBucket {
  if (spanDays <= 31) return 'day';
  if (spanDays <= 120) return 'week';
  return 'month';
}

/** Turns the validated query into concrete dates + bucket with sane defaults. */
export function resolveRange(dto: ReportRangeDto): ResolvedRange {
  const period = dto.period ?? 'quarter';
  const to = dto.to ?? new Date();
  const from =
    dto.from ?? new Date(to.getTime() - PERIOD_DAYS[period] * DAY_MS);
  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / DAY_MS),
  );
  const bucket =
    dto.bucket ??
    (dto.from || dto.to ? deriveBucket(spanDays) : DEFAULT_BUCKET[period]);

  return {
    from,
    to,
    bucket,
    asRange: {
      from: from.toISOString(),
      to: to.toISOString(),
      bucket,
    },
  };
}

/** Swagger documentation shape (validation itself is the Zod schema above). */
export class ReportRangeDtoClass {
  @ApiPropertyOptional({
    enum: PERIODS,
    description: 'Preset range (default: quarter)',
  })
  period?: (typeof PERIODS)[number];

  @ApiPropertyOptional({ description: 'ISO start date (overrides period)' })
  from?: string;

  @ApiPropertyOptional({ description: 'ISO end date (overrides period)' })
  to?: string;

  @ApiPropertyOptional({
    enum: BUCKETS,
    description: 'Series bucket (default derived from range)',
  })
  bucket?: ReportBucket;
}
