/**
 * Organizations route type definitions
 */

import type { InviteEmailCheck } from '@/common/helpers'
import type { useOrgDetailMutations } from '../hooks/use-organization-mutations'
import type { useOrgTeamRoleMutations } from '../hooks/use-org-team-role-mutations'

// Common types are imported from @/common/types
export type { PaginatedOrgsResponse, EditableColumn } from '@/common/types'

/** Roles selectable when inviting or adding an organization member. */
export type OrgMemberRoleSelection = 'org-owner' | 'org-admin' | 'member'

/** State of the "check invite email" hint, or `null` when unchecked. */
export type InviteEmailCheckState = InviteEmailCheck | null

/** Draft column shape used by the retro template create/edit form. */
export type TemplateColumnDraft = {
  name: string
  emoji: string
  prompt: string
  order: number
}

/** Draft value row used by the estimate template create/edit dialog. */
export type EstimateValueDraft = {
  label: string
  value: string
  color: string
  description: string
}

/** Target of the custom-role edit dialog, or `null` when closed. */
export type RoleEditTarget = {
  id: string
  name: string
  sortOrder: number
  isBuiltIn: boolean
} | null

/** Admin listing of built-in and custom team roles for an organization. */
export interface OrgTeamRoleAdminResponse {
  builtIn: Array<{
    id: string
    name: string
    isBuiltIn: boolean
    isActive: boolean
    sortOrder: number
    orgIsActive: boolean
  }>
  custom: Array<{
    id: string
    name: string
    isBuiltIn: boolean
    isActive: boolean
    sortOrder: number
  }>
}

/** Bundle of organization-detail mutations returned by the mutation hook. */
export type OrgDetailMutations = ReturnType<typeof useOrgDetailMutations>

/** Bundle of team-role mutations returned by the mutation hook. */
export type OrgTeamRoleMutations = ReturnType<typeof useOrgTeamRoleMutations>
