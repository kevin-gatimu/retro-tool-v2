import { z } from 'zod'
import type { ReportPeriod } from '../types'

export const REPORT_PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last quarter' },
  { value: 'year', label: 'Last year' },
]

/**
 * Range lives in the URL search params (`?period=quarter`) so dashboards are
 * shareable and bookmarkable. Every reports route validates with this schema
 * and updates via `navigate({ search })`.
 */
export const reportSearchSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).default('quarter'),
})

export type ReportSearch = z.infer<typeof reportSearchSchema>
