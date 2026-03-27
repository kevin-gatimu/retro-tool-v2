import type { TTeamMemberRole } from '@/common/enums/team.enums'
import type { TRetroStatus, TRetroVoteType } from '@/common/enums/retro.enums'

export interface Retro {
  id: string
  name: string
  status: TRetroStatus
  createdAt: Date | string
  teamId: string
  teamName?: string
  teamEmoji?: string
  templateId: string
  templateName?: string
}

export interface RetroDetail extends Retro {
  timerDuration: number | null
  timerEndsAt: Date | string | null
  completedAt?: Date | string | null
  lobbyStartedAt?: Date | string | null
  lobbyAutoStartsAt?: Date | string | null
  isCreator: boolean
  isTeamLead: boolean
  isOrgAdmin?: boolean
  isSystemAdmin?: boolean
  isAnonymous: boolean
  voteType: TRetroVoteType
  maxVotesPerUser: number
  userVoteCount: number
  team: {
    id: string
    name: string
  }
  template: {
    id: string
    name: string
    columns: Array<{
      id: string
      name: string
      emoji: string | null
      prompt: string | null
      order: number
    }>
  }
  participants: Array<{
    id: string
    userId: string
    isOnline?: boolean
    user?: {
      name: string | null
      image: string | null
    } | null
  }>
  currentDiscussionCardId?: string | null
  currentDiscussionActionItemId?: string | null
  cards: Array<{
    id: string
    columnId: string
    content: string
    sourceContents?: string[]
    mergedFromNames?: string[]
    mergedCount?: number
    canUnmerge?: boolean
    isDiscussed?: boolean
    isCarriedForward?: boolean
    discussedAt?: Date | string | null
    voteCount?: number
    hasVoted?: boolean
    isOwn?: boolean
    author: {
      id: string
      name: string | null
      image: string | null
      jobRole: TTeamMemberRole | null
    } | null
    comments: Array<{
      id: string
      content: string
      isOwn?: boolean
      createdAt: Date | string
      author: {
        id: string
        name: string | null
        image: string | null
      } | null
    }>
  }>
}

export interface CreateRetroInput {
  name: string
  teamId: string
  templateId?: string
  isAnonymous?: boolean
  maxVotesPerUser?: number
  voteType?: TRetroVoteType
  timerDuration?: number
}
