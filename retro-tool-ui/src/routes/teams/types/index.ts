/**
 * Teams route type definitions
 */

import type { InviteEmailCheck } from '@/common/helpers'
import type { TeamMemberRow } from '@/components/tables/member-columns'
import type { TeamInvitationRow } from '@/components/tables/invitation-columns'
import type { useTeamMutations } from '../hooks/use-team-mutations'

/** Roles selectable when inviting or adding a team member. */
export type TeamRoleSelection = 'team-lead' | 'member'

/** State of the "check invite email" hint, or `null` when unchecked. */
export type InviteEmailCheckState = InviteEmailCheck | null

/** Bundle of team-detail mutations returned by the mutation hook. */
export type TeamMutations = ReturnType<typeof useTeamMutations>

/** Paginated team members response from the members endpoint. */
export interface PaginatedTeamMembersResponse {
  members: TeamMemberRow[]
  total: number
  page: number
  totalPages: number
}

/** Paginated team invitations response from the invitations endpoint. */
export interface PaginatedTeamInvitationsResponse {
  invitations: TeamInvitationRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}
