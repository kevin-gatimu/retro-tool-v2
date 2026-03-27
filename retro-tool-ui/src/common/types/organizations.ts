import type { TOrgMemberRole } from '@/common/enums/organization.enums'
import type { TUserRole } from '@/common/enums/user.enums'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  website: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
  memberCount?: number
  teamCount?: number
  myRole: TOrgMemberRole
  members?: Array<{
    id: string
    userId: string
    organizationId: string
    role: TOrgMemberRole
    createdAt: Date | string
    user: {
      id: string
      name: string | null
      email: string
      image: string | null
      role: TUserRole
    }
  }>
}

export interface OrganizationDetail extends Organization {
  members: Array<{
    id: string
    userId: string
    organizationId: string
    role: TOrgMemberRole
    createdAt: Date | string
    user: {
      id: string
      name: string | null
      email: string
      image: string | null
      role: TUserRole
    }
  }>
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: string
  joinedAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export interface CreateOrganizationInput {
  name: string
  slug: string
  description?: string
  website?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  description?: string
  logo?: string
  website?: string
}

/**
 * Organization row in paginated list
 */
export type OrganizationRow = {
  id: string
  name: string
  slug: string
  ownerId: string
  memberCount?: number
  logo?: string | null
  myRole?: 'owner' | 'admin' | 'member'
  createdAt: string | Date
}

/**
 * Paginated organizations response
 */
export type PaginatedOrgsResponse = {
  organizations: OrganizationRow[]
  total: number
  page: number
  limit: number
  totalPages?: number
}
