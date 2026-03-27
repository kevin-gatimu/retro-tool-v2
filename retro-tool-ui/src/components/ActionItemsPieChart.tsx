import { Pie, PieChart, ResponsiveContainer, Tooltip, Sector } from 'recharts'

type ActionPieDataItem = {
  name: string
  value: number
  color: string
}

type ChartPalette = {
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

type ActionItemsPieChartProps = {
  data: ActionPieDataItem[]
  palette: ChartPalette
}

export function ActionItemsPieChart({
  data,
  palette,
}: ActionItemsPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          label={({
            name,
            value,
            x,
            y,
          }: {
            name?: string
            value?: number
            x?: number
            y?: number
          }) => (
            <text
              x={x}
              y={y}
              fill="var(--foreground)"
              fontSize={12}
              textAnchor="middle"
            >
              {`${name ?? ''}: ${value ?? ''}`}
            </text>
          )}
          labelLine={{ stroke: 'var(--foreground)' }}
          shape={(props: any) => {
            const color = data[props.index]?.color || '#ccc'
            return <Sector {...props} fill={color} />
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: palette.tooltipBg,
            border: `1px solid ${palette.tooltipBorder}`,
            borderRadius: '8px',
            color: palette.tooltipText,
          }}
          labelStyle={{ color: palette.tooltipText }}
          itemStyle={{ color: palette.tooltipText }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
