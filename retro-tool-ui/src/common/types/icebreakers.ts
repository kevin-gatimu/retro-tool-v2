import type {
  TIcebreakerFlavour,
  TIcebreakerPromptDecision,
  TIcebreakerSelectionMode,
  TIcebreakerSessionStatus,
} from '@/common/enums/icebreaker.enums'

// ============================================================================
// Icebreaker Template Types
// ============================================================================

export interface IcebreakerPrompt {
  id: string
  templateId: string
  text: string
  order: number
  color: string | null
}

export interface IcebreakerTemplate {
  id: string
  name: string
  description: string | null
  flavour: TIcebreakerFlavour
  isBuiltIn: boolean
  organizationId: string | null
  organizationName: string | null
  color: string | null
  prompts: IcebreakerPrompt[]
  createdAt: string | Date
  updatedAt: string | Date
}

export interface PaginatedIcebreakerTemplatesResponse {
  templates: IcebreakerTemplate[]
  total: number
  page: number
  limit: number
}

export interface CreateIcebreakerTemplateInput {
  name: string
  description?: string
  flavour: TIcebreakerFlavour
  organizationId?: string
  color?: string
  prompts: {
    text: string
    order?: number
    color?: string
  }[]
}

// ============================================================================
// Session Types
// ============================================================================

export interface CreateIcebreakerSessionInput {
  name: string
  teamId: string
  templateId?: string
  selectionMode?: TIcebreakerSelectionMode
  flavourFilter?: TIcebreakerFlavour
  timerDuration?: number
}

export interface IcebreakerDeckPrompt {
  id: string
  text: string
  deckOrder: number
  decision: TIcebreakerPromptDecision
  presentedAt: string | Date | null
}

export interface IcebreakerSessionTemplateInfo {
  id: string
  name: string
  flavour: TIcebreakerFlavour
  color: string | null
  prompts: {
    id: string
    text: string
    order: number
    color: string | null
  }[]
}

export interface IcebreakerSession {
  id: string
  name: string
  teamId: string
  currentUserId: string
  createdById: string
  isCreator: boolean
  canManage: boolean
  template: IcebreakerSessionTemplateInfo | null
  templateId: string | null
  status: TIcebreakerSessionStatus
  selectionMode: TIcebreakerSelectionMode
  seed: number
  flavourFilter: TIcebreakerFlavour | null
  currentPromptId: string | null
  currentPrompt: IcebreakerDeckPrompt | null
  deck: IcebreakerDeckPrompt[]
  pendingCount: number
  timerDuration: number | null
  timerEndsAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  team: {
    id: string
    name: string
    emoji?: string | null
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
}

export interface IcebreakerSessionSummary {
  id: string
  name: string
  teamId: string
  status: TIcebreakerSessionStatus
  createdById: string
  templateId: string | null
  createdAt: string | Date
  updatedAt: string | Date
  team: {
    id: string
    name: string
    emoji: string | null
  }
  participants: { userId: string; isOnline: boolean }[]
}

export interface IcebreakerHistorySession {
  id: string
  name: string
  teamId: string
  teamName: string | null
  teamEmoji: string | null
  orgId: string | null
  orgName: string | null
  participantCount: number
  promptCount: number
  keptCount: number
  updatedAt: string | Date
  createdAt: string | Date
  canDelete: boolean
}

export interface IcebreakerHistoryResponse {
  sessions: IcebreakerHistorySession[]
  total: number
  page: number
  limit: number
}
