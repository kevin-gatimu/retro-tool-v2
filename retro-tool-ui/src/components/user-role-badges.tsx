import { Crown, Shield, ShieldAlert, Star, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { isSystemAdmin, isSuperAdmin } from '@/lib/rbac'
import type { TUserRole } from '@/common/enums/user.enums'

type SystemRole = TUserRole
type OrgRole = 'org-owner' | 'org-admin' | 'member' | null
type TeamRole = 'team-lead' | 'member' | null

interface UserRoleBadgesProps {
  systemRole?: SystemRole
  orgRole?: OrgRole
  teamRole?: TeamRole
  showSystemRole?: boolean
  showOrgRole?: boolean
  showTeamRole?: boolean
}

export function UserRoleBadges({
  systemRole,
  orgRole,
  teamRole,
  showSystemRole = true,
  showOrgRole = true,
  showTeamRole = true,
}: UserRoleBadgesProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {showSystemRole && systemRole && isSystemAdmin(systemRole) && (
        <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <ShieldAlert className="h-3 w-3" />
          {isSuperAdmin(systemRole) ? 'Super Admin' : 'System Admin'}
        </Badge>
      )}

      {showOrgRole && orgRole && (
        <>
          {orgRole === 'org-owner' && (
            <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Crown className="h-3 w-3" />
              Org Owner
            </Badge>
          )}
          {orgRole === 'org-admin' && (
            <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Shield className="h-3 w-3" />
              Org Admin
            </Badge>
          )}
          {orgRole === 'member' && !teamRole && (
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" />
              Member
            </Badge>
          )}
        </>
      )}

      {showTeamRole && teamRole && (
        <>
          {teamRole === 'team-lead' && (
            <Badge className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Star className="h-3 w-3" />
              Team Lead
            </Badge>
          )}
          {teamRole === 'member' && (
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" />
              Member
            </Badge>
          )}
        </>
      )}
    </div>
  )
}

export function getOrgRoleBadge(
  role: string | null,
  userSystemRole?: TUserRole,
) {
  const userIsSystemAdmin = userSystemRole
    ? isSystemAdmin(userSystemRole)
    : false

  return (
    <div className="flex items-center gap-1">
      {userIsSystemAdmin && (
        <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <ShieldAlert className="h-3 w-3" />
          {userSystemRole && isSuperAdmin(userSystemRole)
            ? 'Super Admin'
            : 'System Admin'}
        </Badge>
      )}
      {role === 'org-owner' && (
        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Crown className="h-3 w-3" />
          Org Owner
        </Badge>
      )}
      {role === 'org-admin' && (
        <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Shield className="h-3 w-3" />
          Org Admin
        </Badge>
      )}
      {role === 'member' && (
        <Badge variant="secondary" className="gap-1">
          <User className="h-3 w-3" />
          Member
        </Badge>
      )}
    </div>
  )
}

export function getTeamRoleBadge(
  teamRole: string,
  orgRole?: string | null,
  userSystemRole?: TUserRole,
) {
  const userIsSystemAdmin = userSystemRole
    ? isSystemAdmin(userSystemRole)
    : false
  return (
    <div className="flex items-center gap-1">
      {userIsSystemAdmin && (
        <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <ShieldAlert className="h-3 w-3" />
          {userSystemRole && isSuperAdmin(userSystemRole)
            ? 'Super Admin'
            : 'System Admin'}
        </Badge>
      )}
      {!userIsSystemAdmin && orgRole === 'org-owner' && (
        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Crown className="h-3 w-3" />
          Org Owner
        </Badge>
      )}
      {!userIsSystemAdmin && orgRole === 'org-admin' && (
        <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Shield className="h-3 w-3" />
          Org Admin
        </Badge>
      )}
      {teamRole === 'team-lead' && (
        <Badge className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          <Star className="h-3 w-3" />
          Team Lead
        </Badge>
      )}
      {teamRole === 'member' && (
        <Badge variant="secondary" className="gap-1">
          <User className="h-3 w-3" />
          Member
        </Badge>
      )}
    </div>
  )
}
