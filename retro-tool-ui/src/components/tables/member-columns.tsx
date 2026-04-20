import type { ColumnDef } from '@tanstack/react-table'
import {
  Check,
  Clock,
  Crown,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  Star,
  Tag,
  User,
  UserMinus,
  X,
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SortableHeader } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isSystemAdmin } from '@/lib/rbac'
import type { TUserRole } from '@/common/enums/user.enums'

export interface OrgTeamRole {
  id: string
  name: string
  isBuiltIn: boolean
  sortOrder: number
}

const ROLE_PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
]

// ============================================================================
// Organization Member Type
// ============================================================================

export type OrgMemberRow = {
  userId: string
  role: 'org-owner' | 'org-admin' | 'member'
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    role: TUserRole
  }
}

// ============================================================================
// Organization Member Columns
// ============================================================================

export function getOrgMemberColumns(options: {
  isAdmin: boolean
  onUpdateRole: (userId: string, role: 'org-admin' | 'member') => void
  onRemove: (userId: string) => void
}): ColumnDef<OrgMemberRow>[] {
  const columns: ColumnDef<OrgMemberRow>[] = [
    {
      id: 'user',
      accessorFn: (row) => row.user.name ?? row.user.email,
      header: ({ column }) => (
        <SortableHeader column={column}>User</SortableHeader>
      ),
      cell: ({ row }) => {
        const member = row.original
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              image={member.user.image}
              name={member.user.name}
              userId={member.userId}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-medium truncate">
                {member.user.name ?? member.user.email}
              </p>
              {member.user.name && (
                <p className="text-sm text-muted-foreground truncate">
                  {member.user.email}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <SortableHeader column={column}>Org Role</SortableHeader>
      ),
      cell: ({ row }) => {
        const role = row.original.role
        const isSystemAdminUser = isSystemAdmin(row.original.user.role)

        if (role === 'org-owner') {
          return (
            <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Crown className="h-3 w-3" />
              Org Owner
            </Badge>
          )
        }
        if (role === 'org-admin') {
          return (
            <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Shield className="h-3 w-3" />
              Org Admin
            </Badge>
          )
        }
        if (isSystemAdminUser) {
          return (
            <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <ShieldAlert className="h-3 w-3" />
              System Admin
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="gap-1">
            <User className="h-3 w-3" />
            Member
          </Badge>
        )
      },
    },
  ]

  // Add actions column only if user is admin
  if (options.isAdmin) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const member = row.original

        // Don't show actions for org owner
        if (member.role === 'org-owner') {
          return null
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.role === 'member' ? (
                <DropdownMenuItem
                  onClick={() =>
                    options.onUpdateRole(member.userId, 'org-admin')
                  }
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Make Org Admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => options.onUpdateRole(member.userId, 'member')}
                >
                  <User className="mr-2 h-4 w-4" />
                  Make Org Member
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => options.onRemove(member.userId)}
                className="text-destructive"
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Remove from Org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return columns
}

// ============================================================================
// Team Member Type & Columns
// ============================================================================

export type TeamMemberRow = {
  userId: string
  roleId: string | null
  roleName: string | null
  tag: 'team-lead' | 'member'
  orgRole: 'org-owner' | 'org-admin' | 'member' | null
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    role: TUserRole
  }
}

export function getTeamMemberColumns(options: {
  canManage: boolean
  orgRoles: OrgTeamRole[]
  onUpdateHierarchy: (userId: string, tag: 'team-lead' | 'member') => void
  onRemove: (userId: string) => void
  onUpdateJobRole: (userId: string, roleId: string | null) => void
}): ColumnDef<TeamMemberRow>[] {
  const columns: ColumnDef<TeamMemberRow>[] = [
    {
      id: 'user',
      accessorFn: (row) => row.user.name ?? row.user.email,
      header: ({ column }) => (
        <SortableHeader column={column}>Member</SortableHeader>
      ),
      cell: ({ row }) => {
        const member = row.original
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              image={member.user.image}
              name={member.user.name}
              userId={member.userId}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-medium truncate">
                {member.user.name ?? member.user.email}
              </p>
              {member.user.name && (
                <p className="text-sm text-muted-foreground truncate">
                  {member.user.email}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'roleName',
      header: ({ column }) => (
        <SortableHeader column={column}>Team Role</SortableHeader>
      ),
      cell: ({ row }) => {
        const { roleId, roleName } = row.original
        if (!roleId || !roleName) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        const roleIdx = Array.isArray(options.orgRoles)
          ? options.orgRoles.findIndex((r) => r.id === roleId)
          : -1
        const colorClass =
          roleIdx >= 0
            ? ROLE_PALETTE[roleIdx % ROLE_PALETTE.length]
            : 'bg-secondary text-secondary-foreground'
        return <Badge className={`text-xs ${colorClass}`}>{roleName}</Badge>
      },
    },
    {
      accessorKey: 'orgRole',
      header: ({ column }) => (
        <SortableHeader column={column}>Org Role</SortableHeader>
      ),
      cell: ({ row }) => {
        const orgRole = row.original.orgRole
        const isSystemAdminUser = isSystemAdmin(row.original.user.role)

        if (isSystemAdminUser) {
          return (
            <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <ShieldAlert className="h-3 w-3" />
              System Admin
            </Badge>
          )
        }
        if (orgRole === 'org-owner') {
          return (
            <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Crown className="h-3 w-3" />
              Org Owner
            </Badge>
          )
        }
        if (orgRole === 'org-admin') {
          return (
            <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Shield className="h-3 w-3" />
              Org Admin
            </Badge>
          )
        }
        return (
          <Badge variant="secondary">
            <User className="mr-1 h-3 w-3" />
            Org Member
          </Badge>
        )
      },
    },
    {
      accessorKey: 'tag',
      header: ({ column }) => (
        <SortableHeader column={column}>Team Rank</SortableHeader>
      ),
      cell: ({ row }) => {
        const tag = row.original.tag

        if (tag === 'team-lead') {
          return (
            <Badge className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Star className="h-3 w-3" />
              Team Lead
            </Badge>
          )
        }
        return (
          <Badge variant="secondary">
            <User className="mr-1 h-3 w-3" />
            Member
          </Badge>
        )
      },
    },
  ]

  // Add actions column only if user can manage
  if (options.canManage) {
    columns.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const member = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.tag === 'member' ? (
                <DropdownMenuItem
                  onClick={() =>
                    options.onUpdateHierarchy(member.userId, 'team-lead')
                  }
                >
                  <Star className="mr-2 h-4 w-4" />
                  Make Team Lead
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    options.onUpdateHierarchy(member.userId, 'member')
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  Make Team Member
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Tag className="mr-2 h-4 w-4" />
                  Set Team Role
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                  {[...options.orgRoles]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((orgRole) => (
                      <DropdownMenuItem
                        key={orgRole.id}
                        onClick={() =>
                          options.onUpdateJobRole(member.userId, orgRole.id)
                        }
                        className={
                          member.roleId === orgRole.id ? 'font-semibold' : ''
                        }
                      >
                        {orgRole.name}
                        {member.roleId === orgRole.id && (
                          <Check className="ml-auto h-3 w-3" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  {member.roleId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          options.onUpdateJobRole(member.userId, null)
                        }
                        className="text-muted-foreground"
                      >
                        Clear Team Role
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => options.onRemove(member.userId)}
                className="text-destructive"
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Remove from Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return columns
}

// ============================================================================
// Join Request Type
// ============================================================================

export type JoinRequestRow = {
  id: string
  userId: string
  message: string | null
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

// ============================================================================
// Join Request Columns
// ============================================================================

export function getJoinRequestColumns(options: {
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  isApproving?: boolean
  isRejecting?: boolean
}): ColumnDef<JoinRequestRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'user',
      accessorFn: (row) => row.user.name ?? row.user.email,
      header: ({ column }) => (
        <SortableHeader column={column}>User</SortableHeader>
      ),
      cell: ({ row }) => {
        const request = row.original
        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              image={request.user.image}
              name={request.user.name}
              userId={request.userId}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-medium truncate">
                {request.user.name ?? request.user.email}
              </p>
              {request.user.name && (
                <p className="text-xs text-muted-foreground truncate">
                  {request.user.email}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'message',
      header: 'Message',
      cell: ({ row }) => {
        const message = row.original.message
        return message ? (
          <p className="text-sm text-muted-foreground italic truncate max-w-[200px]">
            "{message}"
          </p>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const request = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={() => options.onApprove(request.id)}
              disabled={options.isApproving}
            >
              <Check className="mr-1 h-3 w-3" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-destructive hover:bg-destructive/10"
              onClick={() => options.onReject(request.id)}
              disabled={options.isRejecting}
            >
              <X className="mr-1 h-3 w-3" />
              Reject
            </Button>
          </div>
        )
      },
    },
  ]
}
