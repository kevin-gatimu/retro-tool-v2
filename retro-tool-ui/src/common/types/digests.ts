export interface WeeklyDigest {
  id: string
  teamId: string
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  hourOfDay: number // 0-23
  timezone: string
  includeMetrics: boolean
  includeActionItems: boolean
  includeUpcomingRetros: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  team?: {
    id: string
    name: string
  }
}

export interface CreateDigestInput {
  teamId: string
  dayOfWeek: number
  hourOfDay: number
  timezone: string
  includeMetrics?: boolean
  includeActionItems?: boolean
  includeUpcomingRetros?: boolean
}

export interface UpdateDigestInput {
  dayOfWeek?: number
  hourOfDay?: number
  timezone?: string
  includeMetrics?: boolean
  includeActionItems?: boolean
  includeUpcomingRetros?: boolean
  isActive?: boolean
}
