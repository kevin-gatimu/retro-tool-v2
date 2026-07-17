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

/**
 * A card that has been submitted locally but not yet confirmed by the server.
 * Rendered optimistically in the active phase until the real card syncs back.
 */
export type LocalPendingCard = {
  id: string
  content: string
  author: {
    id: string
    name: string | null
    image: string | null
    jobRole: string | null
  } | null
}

/** Pending cards keyed by column id. */
export type LocalPendingCards = Record<string, Array<LocalPendingCard>>

/** A user currently typing, as projected by Convex presence. */
export type TypingUser = { userId: string; displayName: string }

/** Minimal shape of a mutation passed to a presentational child. */
export type MutateFn<TArg> = (arg: TArg) => void

/** A `useMutation` result narrowed to what presentational children need. */
export type Mutation<TArg = void> = {
  mutate: MutateFn<TArg>
  isPending: boolean
}
