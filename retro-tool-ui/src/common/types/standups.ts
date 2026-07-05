import type {
  TStandupCadence,
  TStandupScheduleDay,
} from '@/common/enums/standup.enums'
import type { PollView } from './polls'

// ============================================================================
// Standup configuration
// ============================================================================

export interface StandupQuestion {
  id: string
  prompt: string
  color: string | null
  order: number
  isRequired: boolean
}

export interface StandupSummary {
  id: string
  name: string
  teamId: string
  cadence: TStandupCadence
  scheduleDays: string
  isActive: boolean
  createdById: string | null
  createdAt: string | Date
  updatedAt: string | Date
  team: {
    id: string
    name: string
    emoji: string | null
  }
  questions: StandupQuestion[]
  memberCount: number
  todaySubmissionCount: number
}

export interface StandupDetail {
  id: string
  name: string
  teamId: string
  cadence: TStandupCadence
  scheduleDays: string
  isActive: boolean
  createdById: string | null
  createdAt: string | Date
  updatedAt: string | Date
  isCreator: boolean
  canManage: boolean
  currentUserId: string
  team: {
    id: string
    name: string
  }
  questions: StandupQuestion[]
}

export interface CreateStandupInput {
  name: string
  teamId: string
  cadence?: TStandupCadence
  scheduleDays: TStandupScheduleDay[]
  questions: {
    prompt: string
    color?: string
    isRequired?: boolean
  }[]
}

export interface UpdateStandupInput {
  name?: string
  cadence?: TStandupCadence
  scheduleDays?: TStandupScheduleDay[]
  isActive?: boolean
  questions?: {
    id?: string
    prompt: string
    color?: string
    isRequired?: boolean
  }[]
}

// ============================================================================
// Daily entry (persistent room)
// ============================================================================

export interface StandupMember {
  userId: string
  name: string
  image: string | null
  jobRole: string | null
  hasSubmitted: boolean
}

export interface StandupAnswer {
  questionId: string
  content: string
}

export interface StandupComment {
  id: string
  authorId: string
  author: { name: string; image: string | null }
  content: string
  createdAt: string | Date
}

export interface StandupReaction {
  emoji: string
  userId: string
  userName: string
}

export interface StandupSubmission {
  id: string
  userId: string
  user: { name: string; image: string | null }
  createdAt: string | Date
  updatedAt: string | Date
  answers: StandupAnswer[]
  comments: StandupComment[]
  reactions: StandupReaction[]
}

export interface StandupEntryDetail {
  standup: StandupDetail
  date: string
  entry: { id: string; entryDate: string } | null
  isScheduledDay: boolean
  members: StandupMember[]
  submissions: StandupSubmission[]
  polls: PollView[]
}

export interface SubmitStandupInput {
  answers: StandupAnswer[]
}
