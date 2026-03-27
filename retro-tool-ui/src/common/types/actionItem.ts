import type { TActionItemStatus } from '@/common/enums/action-item.enums'

export interface ActionItem {
  id: string
  retroId: string
  cardId: string | null
  title: string
  description: string | null
  assigneeId: string | null
  status: TActionItemStatus
  isCarriedForward: boolean
  createdAt: Date
  updatedAt: Date
  assignee?: {
    id: string
    name: string
    image: string | null
  } | null
  card?: {
    id: string
    content: string
  } | null
  retrospective?: {
    id: string
    name: string
    team: {
      id: string
      name: string
    }
  }
}

export interface CreateActionItemInput {
  retroId: string
  cardId?: string
  title: string
  description?: string
  assigneeId?: string
}

export interface UpdateActionItemInput {
  title?: string
  description?: string
  assigneeId?: string
  status?: TActionItemStatus
}
