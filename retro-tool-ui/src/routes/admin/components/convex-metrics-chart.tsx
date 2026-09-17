import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NamedMetricSeries } from '../types'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface ConvexMetricsChartProps {
  title: string
  description: string
  series: NamedMetricSeries[]
  rangeMinutes?: number
  valueSuffix?: string
  maxValue?: number
}

function formatTimestamp(timestamp: string, rangeMinutes: number) {
  const date = new Date(timestamp)
  if (rangeMinutes <= 1440) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (rangeMinutes <= 10_080) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' })
  }
  if (rangeMinutes <= 129_600) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', year: '2-digit' })
}

function rangeBadgeLabel(rangeMinutes: number) {
  if (rangeMinutes <= 60) return null
  if (rangeMinutes <= 1440) return 'Day view'
  if (rangeMinutes <= 10_080) return 'Week view'
  if (rangeMinutes <= 43_200) return 'Month view'
  if (rangeMinutes <= 129_600) return 'Quarter view'
  return 'Year view'
}

export function ConvexMetricsChart({
  title,
  description,
  series,
  rangeMinutes = 60,
  valueSuffix = '',
  maxValue,
}: ConvexMetricsChartProps) {
  const rows = new Map<string, Record<string, number | string | null>>()
  for (const item of series) {
    for (const point of item.points) {
      const row = rows.get(point.timestamp) ?? {
        timestamp: point.timestamp,
        time: formatTimestamp(point.timestamp, rangeMinutes),
      }
      row[item.name] = point.value
      rows.set(point.timestamp, row)
    }
  }
  const data = [...rows.values()].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  )
  const badgeLabel = rangeBadgeLabel(rangeMinutes)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badgeLabel && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {badgeLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No data in this window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                width={42}
                unit={valueSuffix}
                domain={[
                  0,
                  maxValue ??
                    ((dataMax: number) =>
                      Math.max(1, Math.ceil(dataMax * 1.15))),
                ]}
                allowDataOverflow={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                }}
                formatter={(value) => [`${String(value)}${valueSuffix}`]}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              {series.map((item, index) => (
                <Area
                  key={item.name}
                  type="monotone"
                  dataKey={item.name}
                  name={item.name === '_rest' ? 'Other functions' : item.name}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
