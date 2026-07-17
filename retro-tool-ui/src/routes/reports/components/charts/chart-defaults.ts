// Shared Recharts styling hooked to the Tailwind theme's --chart-* variables.

import type { CSSProperties } from 'react'

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

export const tooltipContentStyle: CSSProperties = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: '0.75rem',
}

export const axisTick = { fontSize: 11, fill: 'var(--muted-foreground)' }

/** Every dashboard series descriptor: payload key + legend label + color. */
export interface SeriesDef {
  key: string
  label: string
  color: string
}
