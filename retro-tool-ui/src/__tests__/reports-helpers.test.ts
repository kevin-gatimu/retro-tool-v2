import { describe, expect, it } from 'vitest'
import { reportSearchSchema } from '@/routes/reports/hooks/use-report-range'

describe('reportSearchSchema', () => {
  it('defaults to quarter', () => {
    expect(reportSearchSchema.parse({})).toEqual({ period: 'quarter' })
  })

  it('accepts valid periods', () => {
    expect(reportSearchSchema.parse({ period: 'week' }).period).toBe('week')
  })

  it('rejects unknown periods', () => {
    expect(reportSearchSchema.safeParse({ period: 'decade' }).success).toBe(
      false,
    )
  })
})
