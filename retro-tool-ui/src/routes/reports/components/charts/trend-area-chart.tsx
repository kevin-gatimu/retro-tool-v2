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
import { axisTick, tooltipContentStyle } from './chart-defaults'
import type { SeriesDef } from './chart-defaults'

interface TrendAreaChartProps<TRow extends object> {
  // Recharts reads only the `bucket`/series-key fields by name, so any object
  // row shape is valid — stay generic so concrete point types (which are
  // interfaces without an index signature) assign without a cast.
  data: ReadonlyArray<TRow>
  series: SeriesDef[]
  stacked?: boolean
  height?: number
}

export function TrendAreaChart<TRow extends object>({
  data,
  series,
  stacked = false,
  height = 280,
}: TrendAreaChartProps<TRow>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="bucket" tick={axisTick} tickLine={false} />
        <YAxis tick={axisTick} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipContentStyle} />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        {series.map((entry) => (
          <Area
            key={entry.key}
            type="monotone"
            dataKey={entry.key}
            name={entry.label}
            stackId={stacked ? 'stack' : undefined}
            stroke={entry.color}
            fill={entry.color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default TrendAreaChart
