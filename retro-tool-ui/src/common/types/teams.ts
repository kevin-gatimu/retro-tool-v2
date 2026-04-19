import type {
  TTeamJoinRequestStatus,
  TTeamMemberTag,
} from '@/common/enums/team.enums'
import type { TOrgMemberRole } from '@/common/enums/organization.enums'
import type { TUserRole } from '@/common/enums/user.enums'

export interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  emoji: string | null
  organizationId: string
  createdAt: Date
  updatedAt: Date
  memberCount?: number
  myRole: TTeamMemberTag
  orgRole: TOrgMemberRole
  isMember: boolean
  hasPendingRequest: boolean
  myPendingRequestId: string | null
  isSystemAdmin: boolean
  canSeeMembers: boolean
  members?: TeamMember[]
  joinRequests?: TeamJoinRequest[]
  organization?: {
    id: string
    name: string
    slug: string
  }
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  roleId: string | null
  roleName: string | null
  tag: TTeamMemberTag
  orgRole: TOrgMemberRole | null
  joinedAt: Date | string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    role: TUserRole
  }
}

export interface TeamJoinRequest {
  id: string
  teamId: string
  userId: string
  status: TTeamJoinRequestStatus
  message: string | null
  createdAt: Date | string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export interface CreateTeamInput {
  name: string
  slug?: string
  description?: string
  emoji?: string
  organizationId?: string
}

export interface UpdateTeamInput {
  name?: string
  description?: string | null
  emoji?: string
}

export interface TeamDetail extends Team {
  members: TeamMember[]
  joinRequests: TeamJoinRequest[]
  organization: {
    id: string
    name: string
    slug: string
  }
}
