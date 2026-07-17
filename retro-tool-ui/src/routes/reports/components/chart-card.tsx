import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** Card wrapper with a Suspense boundary so chart chunks lazy-load per card. */
export function ChartCard({
  title,
  description,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
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
