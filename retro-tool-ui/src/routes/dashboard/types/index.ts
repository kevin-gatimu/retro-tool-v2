/**
 * Dashboard route type definitions
 */

export type DashboardStats = {
  totalRetros: number
  totalTeams: number
  totalCards: number
  totalVotes: number
}

export type UserData = {
  id: string
  name: string
  email: string
  createdAt?: Date | string
}

export type SessionData = {
  token: string
  userAgent: string
  ipAddress: string
  createdAt: string | Date
  updatedAt: string | Date
}
