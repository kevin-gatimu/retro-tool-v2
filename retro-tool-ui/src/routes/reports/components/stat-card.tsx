import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricInfo } from './metric-info'
import type { LucideIcon } from 'lucide-react'
import type { MetricExplanation } from '../types'

interface StatCardProps {
  title: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  /** When set, renders an info button explaining how the figure is derived. */
  info?: MetricExplanation
}

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  info,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          {info ? <MetricInfo explanation={info} /> : null}
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
