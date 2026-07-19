import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  Building2,
  CheckCircle,
  Clock,
  Crown,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Star,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  XCircle,
} from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SortableHeader } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {
  TUserRole as UserRole,
  TUserStatus as UserStatus,
} from '@/common/enums/user.enums'
import { isSuperAdmin, isSystemAdmin } from '@/lib/rbac'

// ============================================================================
// User Row Type
// ============================================================================

export type UserRow = {
  id: string
  name: string
  email: string
  image: string | null
  status: UserStatus
  role: UserRole | undefined
  lastActiveAt: string | Date | null
  createdAt: string | Date
}

// ============================================================================
// Status Badge Component
// ============================================================================

export function StatusBadge({ status }: { status: UserStatus }) {
  const config: Record<
    UserStatus,
    { label: string; className: string; icon: typeof Clock }
  > = {
    pending: {
      label: 'Pending',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      icon: Clock,
    },
    approved: {
      label: 'Active',
      className:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle,
    },
    suspended: {
      label: 'Suspended',
      className:
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      icon: Ban,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      icon: XCircle,
    },
  }

  const { label, className, icon: Icon } = config[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ============================================================================
// Role Badge Component
// ============================================================================

// allow missing entries so we can guard against invalid data
const ROLE_CONFIG: Partial<
  Record<UserRole, { label: string; className: string; icon: typeof User }>
> = {
  'super-admin': {
    label: 'Super Admin',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Star,
  },
  'system-admin': {
    label: 'System Admin',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Crown,
  },
  'org-admin': {
    label: 'Org Admin',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Building2,
  },
  'team-lead': {
    label: 'Team Lead',
    className:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    icon: Users,
  },
  member: {
    label: 'Member',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: User,
  },
}

export function RoleBadge({ role }: { role: UserRole | undefined }) {
  const conf = ROLE_CONFIG[role as UserRole] ?? {
    label: role || 'Unknown',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: User,
  }
  const Icon = conf.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${conf.className}`}
    >
      <Icon className="h-3 w-3" />
      {conf.label}
    </span>
  )
}

// ============================================================================
// User Columns
// ============================================================================

export interface UserColumnOptions {
  currentUserId: string
  currentUserRole: UserRole
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
  onSuspend: (user: UserRow) => void
  onReactivate: (userId: string) => void
  /** Promote target to system-admin — super-admin only */
  onPromoteSystemAdmin: (userId: string) => void
  /** Demote system-admin back to member — super-admin only */
  onDemoteToMember: (userId: string) => void
  onViewDetails: (user: UserRow) => void
  onDelete: (user: UserRow) => void
}

export function getUserColumns(
  options: UserColumnOptions,
): ColumnDef<UserRow>[] {
  const viewerIsSystemAdmin = isSystemAdmin(options.currentUserRole)
  const viewerIsSuperAdmin = isSuperAdmin(options.currentUserRole)

  const columns: ColumnDef<UserRow>[] = []

  // Selection column — only for system admins (bulk actions)
  if (viewerIsSystemAdmin) {
    columns.push({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => {
        const user = row.original
        if (user.id === options.currentUserId) return <div className="w-4" />
        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        )
      },
      enableSorting: false,
      enableHiding: false,
    })
  }

  // User column (avatar + name + email + role icon)
  columns.push({
    id: 'user',
    accessorFn: (row) => row.name,
    header: ({ column }) => (
      <SortableHeader column={column}>User</SortableHeader>
    ),
    cell: ({ row }) => {
      const user = row.original
      const isCurrentUser = user.id === options.currentUserId
      // defensively handle missing/invalid roles - fall back to generic User icon
      // Even with Partial, roleConf may be undefined if the role is missing
      const roleConf = ROLE_CONFIG[user.role!] ?? {
        icon: User,
        label: user.role ?? 'Unknown',
        className:
          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      }
      const RoleIcon = roleConf.icon

      return (
        <div className="flex items-center gap-3">
          <UserAvatar
            image={user.image}
            name={user.name}
            userId={user.id}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{user.name}</p>
              {user.role !== 'member' && (
                <RoleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              {isCurrentUser && (
                <Badge variant="secondary" className="text-xs">
                  You
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
      )
    },
  })

  // Status column
  columns.push({
    accessorKey: 'status',
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  })

  // Role column — coloured badge
  columns.push({
    accessorKey: 'role',
    header: ({ column }) => (
      <SortableHeader column={column}>Role</SortableHeader>
    ),
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  })

  // Last Active column
  columns.push({
    accessorKey: 'lastActiveAt',
    header: ({ column }) => (
      <SortableHeader column={column}>Last Active</SortableHeader>
    ),
    cell: ({ row }) => {
      const lastActive = row.original.lastActiveAt
      return (
        <span className="text-sm text-muted-foreground">
          {lastActive ? new Date(lastActive).toLocaleDateString() : 'Never'}
        </span>
      )
    },
  })

  // Actions column
  columns.push({
    id: 'actions',
    header: () => <span>Actions</span>,
    cell: ({ row }) => {
      const user = row.original
      const isCurrentUser = user.id === options.currentUserId
      const targetIsSystemAdmin = isSystemAdmin(user.role)
      const targetIsSuperAdmin = isSuperAdmin(user.role)

      // Non-system-admins can only view details
      if (!viewerIsSystemAdmin) {
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => options.onViewDetails(user)}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View details</span>
          </Button>
        )
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
            <DropdownMenuItem onClick={() => options.onViewDetails(user)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Status actions */}
            {user.status === 'pending' && (
              <>
                <DropdownMenuItem onClick={() => options.onApprove(user.id)}>
                  <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => options.onReject(user.id)}>
                  <UserX className="mr-2 h-4 w-4 text-red-500" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            {user.status === 'approved' &&
              !isCurrentUser &&
              !targetIsSuperAdmin &&
              !(targetIsSystemAdmin && !viewerIsSuperAdmin) && (
                <DropdownMenuItem onClick={() => options.onSuspend(user)}>
                  <Ban className="mr-2 h-4 w-4 text-orange-500" />
                  Suspend
                </DropdownMenuItem>
              )}
            {user.status === 'suspended' &&
              !(targetIsSystemAdmin && !viewerIsSuperAdmin) && (
                <DropdownMenuItem onClick={() => options.onReactivate(user.id)}>
                  <RefreshCw className="mr-2 h-4 w-4 text-green-500" />
                  Reactivate
                </DropdownMenuItem>
              )}
            {user.status === 'rejected' && (
              <DropdownMenuItem onClick={() => options.onApprove(user.id)}>
                <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                Approve
              </DropdownMenuItem>
            )}

            {/* Role actions — super-admin only */}
            {viewerIsSuperAdmin && !isCurrentUser && !targetIsSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                {!targetIsSystemAdmin ? (
                  <DropdownMenuItem
                    onClick={() => options.onPromoteSystemAdmin(user.id)}
                  >
                    <Shield className="mr-2 h-4 w-4 text-amber-500" />
                    Promote to System Admin
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => options.onDemoteToMember(user.id)}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Demote to Member
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* Delete — system-admin can delete, but not super-admins or self */}
            {!isCurrentUser && !targetIsSuperAdmin && !targetIsSystemAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => options.onDelete(user)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  })

  return columns
}
