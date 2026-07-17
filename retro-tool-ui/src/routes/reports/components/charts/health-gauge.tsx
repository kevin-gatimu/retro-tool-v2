import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts'

interface HealthGaugeProps {
  score: number
  description: string
  height?: number
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--chart-2)'
  if (score >= 60) return 'var(--chart-1)'
  if (score >= 40) return 'var(--chart-4)'
  return 'var(--destructive)'
}

export function HealthGauge({
  score,
  description,
  height = 220,
}: HealthGaugeProps) {
  const data = [{ name: 'health', value: score }]
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          data={data}
          startAngle={210}
          endAngle={-30}
          innerRadius="70%"
          outerRadius="100%"
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            dataKey="value"
            angleAxisId={0}
            fill={scoreColor(score)}
            cornerRadius={8}
            background={{ fill: 'var(--muted)' }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold">{score}</span>
        <span className="max-w-40 text-center text-xs text-muted-foreground">
          {description}
        </span>
      </div>
    </div>
  )
}

export default HealthGauge
