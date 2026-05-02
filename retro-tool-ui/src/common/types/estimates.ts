import type { TEstimateSessionStatus } from '@/common/enums/estimate.enums'

// ============================================================================
// Estimate Template Types
// ============================================================================

export interface EstimateTemplateValue {
  id: string
  templateId: string
  label: string
  value: string
  order: number
  color: string | null
  description: string | null
}

export interface EstimateTemplate {
  id: string
  name: string
  description: string | null
  isBuiltIn: boolean
  organizationId: string | null
  organizationName: string | null
  color: string | null
  values: EstimateTemplateValue[]
  createdAt: string | Date
  updatedAt: string | Date
}

export interface PaginatedEstimateTemplatesResponse {
  templates: EstimateTemplate[]
  total: number
  page: number
  limit: number
}

export interface CreateEstimateTemplateInput {
  name: string
  description?: string
  organizationId?: string
  color?: string
  values: {
    label: string
    value: string
    order?: number
    color?: string
    description?: string
  }[]
}

export interface UpdateEstimateTemplateInput {
  name?: string
  description?: string | null
  color?: string | null
  values?: {
    label: string
    value: string
    order?: number
    color?: string | null
    description?: string | null
  }[]
}

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
  agreedPoints: string | null
  stats: {
    votesCount: number
    average: number | null
    min: number | null
    max: number | null
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
      jobRole: string | null
    }
  }[]
}

export interface SessionTemplateInfo {
  id: string
  name: string
  color: string | null
  values: {
    id: string
    label: string
    value: string
    order: number
    color: string | null
    description: string | null
  }[]
}

export interface EstimateSession {
  id: string
  name: string
  teamId: string
  currentUserId: string
  createdById: string
  isCreator: boolean
  canEndSession?: boolean
  userVote?: string | null
  template: SessionTemplateInfo | null
  templateId: string | null
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
    createdAt: Date
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
      jobRole: string | null
    }
  }[]
}

export interface CreateSessionInput {
  name: string
  teamId: string
  sprintLink?: string
  timerDuration?: number
  templateId?: string
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
