import type { ColumnDef } from '@tanstack/react-table'
import {
  Clock,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Star,
  Trash2,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortableHeader } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ============================================================================
// Types
// ============================================================================

export interface OrgInvitationRow {
  id: string
  email: string
  role: string
  createdAt: string | Date
  expiresAt: string | Date
  invitedBy: { id: string | null; name: string | null; email: string | null }
}

export interface TeamInvitationRow {
  id: string
  email: string
  tag: string
  createdAt: string | Date
  expiresAt: string | Date
  invitedBy: { id: string | null; name: string | null; email: string | null }
}

// ============================================================================
// Helpers
// ============================================================================

function getInvitationStatus(expiresAt: string | Date): 'pending' | 'expired' {
  return new Date(expiresAt) < new Date() ? 'expired' : 'pending'
}

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function formatRelativeTime(date: string | Date): string {
  const diff = new Date(date).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

// ============================================================================
// Organization Invitation Columns
// ============================================================================

export function getOrgInvitationColumns(options: {
  onResend: (invitationId: string) => void
  onRevoke: (invitationId: string) => void
}): ColumnDef<OrgInvitationRow>[] {
  return [
    {
      id: 'email',
      accessorKey: 'email',
      header: ({ column }) => (
        <SortableHeader column={column}>Email</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: 'role',
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.role
        const label =
          role === 'org-owner'
            ? 'Owner'
            : role === 'org-admin'
              ? 'Admin'
              : 'Member'
        const Icon =
          role === 'org-owner' ? Shield : role === 'org-admin' ? Shield : User
        return (
          <Badge variant="outline" className="gap-1 font-normal">
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        )
      },
    },
    {
      id: 'invitedBy',
      accessorKey: 'invitedBy',
      header: 'Invited By',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.invitedBy.name ?? row.original.invitedBy.email ?? '—'}
        </span>
      ),
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <SortableHeader column={column}>Sent</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'expiresAt',
      header: 'Status',
      cell: ({ row }) => {
        const status = getInvitationStatus(row.original.expiresAt)
        if (status === 'expired') {
          return (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              Expired
            </Badge>
          )
        }
        return (
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(row.original.expiresAt)}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => options.onResend(row.original.id)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend Invitation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => options.onRevoke(row.original.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Revoke Invitation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}

// ============================================================================
// Team Invitation Columns
// ============================================================================

export function getTeamInvitationColumns(options: {
  onResend: (invitationId: string) => void
  onRevoke: (invitationId: string) => void
}): ColumnDef<TeamInvitationRow>[] {
  return [
    {
      id: 'email',
      accessorKey: 'email',
      header: ({ column }) => (
        <SortableHeader column={column}>Email</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: 'tag',
      accessorKey: 'tag',
      header: 'Role',
      cell: ({ row }) => {
        const tag = row.original.tag
        const label = tag === 'team-lead' ? 'Team Lead' : 'Member'
        const Icon = tag === 'team-lead' ? Star : User
        return (
          <Badge variant="outline" className="gap-1 font-normal">
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        )
      },
    },
    {
      id: 'invitedBy',
      accessorKey: 'invitedBy',
      header: 'Invited By',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.invitedBy.name ?? row.original.invitedBy.email ?? '—'}
        </span>
      ),
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <SortableHeader column={column}>Sent</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'expiresAt',
      header: 'Status',
      cell: ({ row }) => {
        const status = getInvitationStatus(row.original.expiresAt)
        if (status === 'expired') {
          return (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              Expired
            </Badge>
          )
        }
        return (
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(row.original.expiresAt)}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => options.onResend(row.original.id)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend Invitation
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => options.onRevoke(row.original.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Revoke Invitation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
