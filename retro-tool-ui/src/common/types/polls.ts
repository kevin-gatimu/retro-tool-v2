// ============================================================================
// Polls (standalone and standup-attached)
// ============================================================================

export interface PollOptionView {
  id: string
  label: string
  emoji: string | null
  order: number
  voteCount: number
  /** Only populated for non-anonymous polls. */
  voters: { userId: string; name: string; image: string | null }[]
  isOwnVote: boolean
}

export interface PollView {
  id: string
  question: string
  teamId: string
  standupId: string | null
  entryDate: string | null
  isAnonymous: boolean
  isClosed: boolean
  createdById: string | null
  createdAt: string | Date
  updatedAt: string | Date
  isCreator: boolean
  canManage: boolean
  currentUserId: string
  team: { id: string; name: string; emoji: string | null }
  createdBy: { id: string; name: string; image: string | null } | null
  options: PollOptionView[]
  totalVotes: number
  hasVoted: boolean
}

export interface CreatePollInput {
  question: string
  teamId: string
  standupId?: string
  entryDate?: string
  isAnonymous?: boolean
  options: { label: string; emoji?: string | null }[]
}

export interface UpdatePollInput {
  question?: string
  isAnonymous?: boolean
  /** Include an option `id` to preserve its votes; omit `id` for new options.
   *  Options no longer present are removed. */
  options?: { id?: string; label: string; emoji?: string | null }[]
}
