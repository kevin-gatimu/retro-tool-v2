import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisTick, tooltipContentStyle } from './chart-defaults'
import type { SeriesDef } from './chart-defaults'

interface StackedBarChartProps<TRow extends object> {
  // Recharts resolves x/series values by data-key at runtime, so report point
  // interfaces do not need an artificial string index signature.
  data: ReadonlyArray<TRow>
  series: SeriesDef[]
  xKey?: string
  stacked?: boolean
  layout?: 'horizontal' | 'vertical'
  height?: number
}

export function StackedBarChart<TRow extends object>({
  data,
  series,
  xKey = 'bucket',
  stacked = true,
  layout = 'horizontal',
  height = 280,
}: StackedBarChartProps<TRow>) {
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={vertical ? 'vertical' : 'horizontal'}
        accessibilityLayer
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        {vertical ? (
          <>
            <XAxis type="number" tick={axisTick} allowDecimals={false} />
            <YAxis type="category" dataKey={xKey} tick={axisTick} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axisTick} tickLine={false} />
            <YAxis tick={axisTick} tickLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={tooltipContentStyle} />
        {series.length > 1 ? (
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        ) : null}
        {series.map((entry) => (
          <Bar
            key={entry.key}
            dataKey={entry.key}
            name={entry.label}
            stackId={stacked ? 'stack' : undefined}
            fill={entry.color}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export default StackedBarChart
