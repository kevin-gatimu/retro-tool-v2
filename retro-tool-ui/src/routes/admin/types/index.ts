/**
 * Admin route type definitions
 */

// Import common types
import type {
  EditableColumn,
  PaginatedTemplatesResponse as CommonPaginatedTemplatesResponse,
} from '@/common/types'
import type { TUserStatus, TUserRole } from '@/common/enums/user.enums'
import type { TOrgMemberRole } from '@/common/enums/organization.enums'

// ─────────────────────────────────────────────────────────────────────────────
// org-setup.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatedOrg {
  id: string
  name: string
}

export interface SelectedUser {
  id: string
  name: string
  email: string
}

export interface TeamDraft {
  name: string
  leadId?: string
  leadName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// users.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type UserDetails = {
  user: {
    id: string
    name: string
    email: string
    status: TUserStatus
    role: TUserRole
    image?: string | null
    bio?: string | null
    suspendedReason?: string | null
    suspendedAt?: string | Date | null
    createdAt: string | Date
    lastActiveAt?: string | Date | null
  }
  organizations: Array<{
    id: string
    role: TOrgMemberRole
    organization: { name: string }
  }>
  teams: Array<{
    id: string
    role: string | null
    tag: string
    team: { name: string; organization: { name: string } }
  }>
  actionHistory: Array<{
    id: string
    action: string
    createdAt: string | Date
    admin?: { name: string } | null
  }>
}

export type UsersPage = {
  users: Array<{
    id: string
    name: string
    email: string
    status: TUserStatus
    role: TUserRole
    image?: string | null
    createdAt: string | Date
    lastActiveAt?: string | Date | null
  }>
  total: number
  page: number
  limit: number
  totalPages: number
  stats: {
    pending: number
    approved: number
    suspended: number
    rejected: number
    admins: number
  }
}

export type ActionLogEntry = {
  id: string
  action: string
  details?: Record<string, unknown> | null
  createdAt: string | Date
  admin?: { name: string } | null
  targetUser?: { name: string } | null
}

export type PaginatedActionLog = {
  logs: ActionLogEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─────────────────────────────────────────────────────────────────────────────
// templates.tsx types
// ─────────────────────────────────────────────────────────────────────────────

// EditableColumn is imported from @/common/helpers
export type { EditableColumn }

export type TemplateWithColumns = {
  id: string
  name: string
  description?: string | null
  organizationId?: string | null
  organizationName?: string | null
  isBuiltIn: boolean
  createdAt: string | Date
  updatedAt: string | Date
  columns: Array<{
    id: string
    name: string
    emoji: string | null
    prompt: string | null
    order: number
  }>
}

// Use common PaginatedTemplatesResponse
export type PaginatedTemplatesResponse = CommonPaginatedTemplatesResponse

// ─────────────────────────────────────────────────────────────────────────────
// organizations.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type OrganizationAdminRow = {
  id: string
  name: string
  slug: string
  ownerId: string
  memberCount?: number
  createdAt: string | Date
}

export type PaginatedOrgsResponse = {
  organizations: OrganizationAdminRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}
