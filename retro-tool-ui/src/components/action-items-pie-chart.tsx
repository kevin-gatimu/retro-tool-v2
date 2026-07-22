import { Pie, PieChart, ResponsiveContainer, Tooltip, Sector } from 'recharts'
import type { PieSectorShapeProps } from 'recharts'

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
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            shape={(props: PieSectorShapeProps) => {
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

      <div className="flex justify-center gap-5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground">
              {item.name}:{' '}
              <span className="font-medium text-foreground">{item.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
