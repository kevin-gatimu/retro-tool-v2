import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REPORT_PERIODS } from '../hooks/use-report-range'
import type { ReportPeriod } from '../types'

interface ReportPageHeaderProps {
  title: string
  description: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
  actions?: ReactNode
  /** report-type switcher + any secondary team/org picker, shown above the title */
  switcher?: ReactNode
}

export function ReportPageHeader({
  title,
  description,
  period,
  onPeriodChange,
  actions,
  switcher,
}: ReportPageHeaderProps) {
  return (
    <div className="space-y-4">
      {switcher ? (
        <div className="flex flex-wrap items-center gap-2">{switcher}</div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Select
            value={period}
            onValueChange={(value) => onPeriodChange(value as ReportPeriod)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PERIODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
