/**
 * Estimate route type definitions
 */

export type HistorySession = {
  id: string
  name: string
  teamId: string
  teamName: string | null
  teamEmoji: string | null
  orgId: string | null
  orgName: string | null
  currentStory: string | null
  participantCount: number
  roundCount: number
  storiesEstimated: number
  totalVotes: number
  updatedAt: string
  createdAt: string
  canDelete: boolean
}

export type HistoryResponse = {
  sessions: HistorySession[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * A single selectable point card in a live estimate session — sourced either
 * from the session template values or from the default fallback scale.
 */
export type VoteOption = {
  label: string
  value: string
  color: string | null
}
