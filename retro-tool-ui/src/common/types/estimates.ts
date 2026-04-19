import type { TEstimateSessionStatus } from '@/common/enums/estimate.enums'

export interface EstimateRoundInput {
  ticketNumber: string
  storyName?: string
  storyDescription?: string
  storyLink?: string
}

export interface EstimateRound {
  id: string
  roundNumber: number
  storyName: string
  ticketNumber: string
  storyDescription: string | null
  storyLink: string | null
  status: string
  revealedAt: Date | null
  createdAt: Date
  updatedAt: Date
  stats: {
    votesCount: number
    average: number | null
    min: number | null
    max: number | null
    consensus: string | null
  }
  votes: {
    id: string
    voterId: string
    userId: string
    points: string
    value: string
    user: {
      id: string
      name: string
    }
  }[]
}

export interface EstimateSession {
  id: string
  name: string
  teamId: string
  currentUserId: string
  createdById: string
  isCreator: boolean
  userVote?: string | null
  status: TEstimateSessionStatus
  sprintLink: string | null
  currentStory: string | null
  currentRound: {
    id: string
    roundNumber: number
    storyName: string
    ticketNumber: string
    storyDescription: string | null
    storyLink: string | null
    status: string
  } | null
  rounds: EstimateRound[]
  timerDuration: number | null
  timerEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
  team: {
    id: string
    name: string
  }
  createdBy: {
    id: string
    name: string
    image: string | null
  } | null
  participants: {
    id: string
    userId: string
    isOnline: boolean
    user: {
      id: string
      name: string
      image: string | null
      jobRole: string | null
    }
  }[]
  votes: {
    id: string
    voterId: string
    userId: string
    points: string
    value: string
    user: {
      id: string
      name: string
    }
  }[]
}

export interface CreateSessionInput {
  name: string
  teamId: string
  sprintLink?: string
  timerDuration?: number
}

export interface UpdateSessionInput {
  name?: string
  currentStory?: string
  timerDuration?: number
  status?: TEstimateSessionStatus
}

export interface Estimate {
  id: string
  sessionId: string
  voterId: string
  userId: string
  points: string
  value: string
  createdAt: Date
  user: {
    id: string
    name: string
    image: string | null
  } | null
}

export interface CreateEstimateInput {
  sessionId: string
  value: string
}
