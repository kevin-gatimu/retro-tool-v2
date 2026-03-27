export const HEALTH_SCORE_TRENDS = {
  Increasing: 'increasing',
  Decreasing: 'decreasing',
  Stable: 'stable',
} as const

export type THealthScoreTrend =
  (typeof HEALTH_SCORE_TRENDS)[keyof typeof HEALTH_SCORE_TRENDS]
