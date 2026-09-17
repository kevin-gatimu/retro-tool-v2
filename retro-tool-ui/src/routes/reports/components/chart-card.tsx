import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricInfo } from './metric-info'
import type { MetricExplanation } from '../types'

interface ChartCardProps {
  title: string
  description?: string
  /** When set, renders an info button explaining how the chart is derived. */
  info?: MetricExplanation
  children: ReactNode
  className?: string
}

/** Card wrapper with a Suspense boundary so chart chunks lazy-load per card. */
export function ChartCard({
  title,
  description,
  info,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {info ? <MetricInfo explanation={info} className="-mt-0.5" /> : null}
        </div>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
          {children}
        </Suspense>
      </CardContent>
    </Card>
  )
}
