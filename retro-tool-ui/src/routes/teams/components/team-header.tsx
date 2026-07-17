import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Clock,
  LogOut,
  MoreHorizontal,
  Settings,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { getTeamRoleBadge } from '@/components/user-role-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TeamDetail } from '@/common/types/teams'
import type { TeamMutations } from '../types'

interface TeamHeaderProps {
  team: TeamDetail
  orgName: string
  isMember: boolean
  isOrgAdmin: boolean
  canManage: boolean
  joinMutation: TeamMutations['joinMutation']
  onEdit: () => void
  onLeave: () => void
  onDelete: () => void
  onRequestToJoin: () => void
  onCancelRequest: () => void
}

export function TeamHeader({
  team,
  orgName,
  isMember,
  isOrgAdmin,
  canManage,
  joinMutation,
  onEdit,
  onLeave,
  onDelete,
  onRequestToJoin,
  onCancelRequest,
}: TeamHeaderProps) {
  return (
    <div className="mb-8">
      <Link
        to="/organizations/$orgId"
        params={{ orgId: team.organizationId }}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to {orgName}
      </Link>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{team.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
              {getTeamRoleBadge(
                team.myRole,
                team.orgRole,
                team.isSystemAdmin ? 'system-admin' : undefined,
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{orgName}</span>
            </div>
            {team.description && (
              <p className="mt-2 text-muted-foreground">{team.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isMember && !team.hasPendingRequest && isOrgAdmin && (
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Join Team
            </Button>
          )}
          {!isMember && !team.hasPendingRequest && !isOrgAdmin && (
            <Button onClick={onRequestToJoin}>
              <UserPlus className="mr-2 h-4 w-4" />
              Request to Join
            </Button>
          )}
          {!isMember && team.hasPendingRequest && (
            <Button variant="outline" onClick={onCancelRequest}>
              <Clock className="mr-2 h-4 w-4" />
              Request Pending
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && (
                <DropdownMenuItem onClick={onEdit}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Team
                </DropdownMenuItem>
              )}
              {isMember && (
                <DropdownMenuItem
                  onClick={onLeave}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Team
                </DropdownMenuItem>
              )}
              {isOrgAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Team
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
