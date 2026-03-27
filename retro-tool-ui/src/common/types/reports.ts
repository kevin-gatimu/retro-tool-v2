import type { THealthScoreTrend } from '@/common/enums/reports.enums'

export interface TeamMetrics {
  period: string
  periodStart: Date | string
  periodEnd: Date | string
  retroCount: number
  avgParticipants: number
  participationRate: number
  totalCards: number
  totalVotes: number
  avgCardsPerRetro: number
  actionItemsCompleted: number
  actionItemsPending: number
}

export interface HealthScore {
  score: number
  trend: THealthScoreTrend
  description: string
  participationPoints: number
  engagementPoints: number
  completionPoints: number
  frequencyPoints: number
  maxScore?: number
  retrospectivesCount?: number
  periodStart?: Date | string
  periodEnd?: Date | string
}

export interface TeamActionItemAnalytics {
  completed: number
  pending: number
  overdue: number
  completionRate: number
  topAssignees: Array<{
    userId: string
    userName: string
    assignedCount: number
    completedCount: number
  }>
}

export interface StoredMetric {
  id: string
  teamId: string
  metricType: string
  value: string
  period: string
  periodStart: Date
  periodEnd: Date
  createdAt: Date
}
