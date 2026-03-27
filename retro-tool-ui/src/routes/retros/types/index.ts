/**
 * Retros route type definitions
 */

// Import common types
import type { PaginatedTemplatesResponse as CommonPaginatedTemplatesResponse } from '@/common/types'

export type CarriedForwardItem = {
  id: string
  title: string
  description: string | null
  sourceContents?: string[]
  status?: 'pending' | 'in_progress' | 'completed'
  likesCount?: number
  hasLiked?: boolean
  comments?: Array<{
    id: string
    content: string
    isOwn: boolean
    createdAt: string | Date
    author: {
      id: string
      name: string | null
      image: string | null
    } | null
  }>
}

export type Step = 'template' | 'team' | 'settings' | 'confirm'

// Use common PaginatedTemplatesResponse
export type PaginatedTemplatesResponse = CommonPaginatedTemplatesResponse
