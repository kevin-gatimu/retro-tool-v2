import type { Dispatch, SetStateAction } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react'
import { getTeamMemberColumns } from '@/components/tables/member-columns'
import type {
  OrgTeamRole,
  TeamMemberRow,
} from '@/components/tables/member-columns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Organization } from '@/common/types/organizations'
import type { User } from '@/common/types/users'
import type { useTeamMembers } from '../hooks'
import type {
  InviteEmailCheckState,
  TeamMutations,
  TeamRoleSelection,
} from '../types'
import { InviteMemberDialog } from './invite-member-dialog'
import { AddMemberDialog } from './add-member-dialog'

type OrgMember = NonNullable<Organization['members']>[number]

interface TeamMembersSectionProps {
  teamId: string
  displayedMemberCount: number
  canManage: boolean
  /** Viewer is org-admin/owner or system-admin (has authority over lead rows). */
  viewerIsOrgAdminOrAbove: boolean
  /** Viewer's own user id, so a plain lead can still manage their own row. */
  viewerUserId: string | null
  canSeeMembers: boolean
  isMember: boolean
  isOrgAdmin: boolean
  hasPendingRequest: boolean
  teamMembersQuery: ReturnType<typeof useTeamMembers>
  pagedMembers: TeamMemberRow[]
  totalMembersCount: number
  totalMemberPages: number
  memberPage: number
  memberPageSize: number
  onMemberPageChange: Dispatch<SetStateAction<number>>
  onMemberPageSizeChange: (size: number) => void
  orgRoles: OrgTeamRole[]
  memberRowSelection: Record<string, boolean>
  onMemberRowSelectionChange: Dispatch<SetStateAction<Record<string, boolean>>>
  selectedMemberIds: string[]
  onClearMemberSelection: () => void
  onJoin: () => void
  onRequestToJoin: () => void
  onCancelRequest: () => void
  onRemoveMember: (userId: string) => void
  // Invite dialog
  isInviteOpen: boolean
  onInviteOpenChange: (open: boolean) => void
  inviteEmail: string
  onInviteEmailChange: (value: string) => void
  inviteTag: TeamRoleSelection
  onInviteTagChange: (value: TeamRoleSelection) => void
  inviteEmailCheck: InviteEmailCheckState
  onInviteEmailCheckChange: (value: InviteEmailCheckState) => void
  // Add member dialog
  isAddMemberOpen: boolean
  onAddMemberOpenChange: (open: boolean) => void
  memberSearch: string
  onMemberSearchChange: (value: string) => void
  isSearching: boolean
  availableMembers: OrgMember[]
  filteredSearchResults: User[]
  addMemberUserIds: string[]
  onToggleAddMemberSelection: (userId: string) => void
  onClearAddMemberSelection: () => void
  addMemberRole: TeamRoleSelection
  onAddMemberRoleChange: (value: TeamRoleSelection) => void
  mutations: TeamMutations
}

export function TeamMembersSection({
  teamId,
  displayedMemberCount,
  canManage,
  viewerIsOrgAdminOrAbove,
  viewerUserId,
  canSeeMembers,
  isMember,
  isOrgAdmin,
  hasPendingRequest,
  teamMembersQuery,
  pagedMembers,
  totalMembersCount,
  totalMemberPages,
  memberPage,
  memberPageSize,
  onMemberPageChange,
  onMemberPageSizeChange,
  orgRoles,
  memberRowSelection,
  onMemberRowSelectionChange,
  selectedMemberIds,
  onClearMemberSelection,
  onJoin,
  onRequestToJoin,
  onCancelRequest,
  onRemoveMember,
  isInviteOpen,
  onInviteOpenChange,
  inviteEmail,
  onInviteEmailChange,
  inviteTag,
  onInviteTagChange,
  inviteEmailCheck,
  onInviteEmailCheckChange,
  isAddMemberOpen,
  onAddMemberOpenChange,
  memberSearch,
  onMemberSearchChange,
  isSearching,
  availableMembers,
  filteredSearchResults,
  addMemberUserIds,
  onToggleAddMemberSelection,
  onClearAddMemberSelection,
  addMemberRole,
  onAddMemberRoleChange,
  mutations,
}: TeamMembersSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Members ({displayedMemberCount})
        </h2>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <InviteMemberDialog
                teamId={teamId}
                open={isInviteOpen}
                onOpenChange={onInviteOpenChange}
                inviteEmail={inviteEmail}
                onInviteEmailChange={onInviteEmailChange}
                inviteTag={inviteTag}
                onInviteTagChange={onInviteTagChange}
                inviteEmailCheck={inviteEmailCheck}
                onInviteEmailCheckChange={onInviteEmailCheckChange}
                inviteMemberMutation={mutations.inviteMemberMutation}
              />
              <AddMemberDialog
                open={isAddMemberOpen}
                onOpenChange={onAddMemberOpenChange}
                memberSearch={memberSearch}
                onMemberSearchChange={onMemberSearchChange}
                onClearSelection={onClearAddMemberSelection}
                isSearching={isSearching}
                availableMembers={availableMembers}
                filteredSearchResults={filteredSearchResults}
                addMemberUserIds={addMemberUserIds}
                onToggleSelection={onToggleAddMemberSelection}
                addMemberRole={addMemberRole}
                onAddMemberRoleChange={onAddMemberRoleChange}
                addMemberMutation={mutations.addMemberMutation}
              />
            </>
          )}
        </div>
      </div>

      {!canSeeMembers ? null : teamMembersQuery.data?.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No members yet</h3>
            <p className="mb-4 text-center text-muted-foreground">
              Be the first to join this team!
            </p>
            {!isMember && !hasPendingRequest && isOrgAdmin && (
              <Button onClick={onJoin}>
                <UserPlus className="mr-2 h-4 w-4" />
                Join Team
              </Button>
            )}
            {!isMember && !hasPendingRequest && !isOrgAdmin && (
              <Button onClick={onRequestToJoin}>
                <UserPlus className="mr-2 h-4 w-4" />
                Request to Join
              </Button>
            )}
            {!isMember && hasPendingRequest && (
              <Button variant="outline" onClick={onCancelRequest}>
                <Clock className="mr-2 h-4 w-4" />
                Request Pending
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            {teamMembersQuery.isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <DataTable
              columns={getTeamMemberColumns({
                canManage: !!canManage,
                viewerIsOrgAdminOrAbove,
                viewerUserId,
                orgRoles,
                onUpdateHierarchy: (userId, tag) =>
                  mutations.updateHierarchyMutation.mutate({ userId, tag }),
                onRemove: (userId) => onRemoveMember(userId),
                onUpdateJobRole: (userId, roleId) =>
                  mutations.updateJobRoleMutation.mutate({ userId, roleId }),
              })}
              data={pagedMembers}
              searchColumn="user"
              searchPlaceholder="Search members..."
              pagination={false}
              selectable={canManage}
              rowSelection={memberRowSelection}
              onRowSelectionChange={onMemberRowSelectionChange}
              getRowId={(row) => row.userId}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {totalMembersCount} row(s) total.
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Rows per page
                </span>
                <Select
                  value={String(memberPageSize)}
                  onValueChange={(value) =>
                    onMemberPageSizeChange(Number(value))
                  }
                >
                  <SelectTrigger className="h-8 w-17.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {memberPage} of {totalMemberPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onMemberPageChange((prev) => Math.max(1, prev - 1))
                  onClearMemberSelection()
                }}
                disabled={memberPage <= 1 || teamMembersQuery.isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onMemberPageChange((prev) =>
                    Math.min(totalMemberPages, prev + 1),
                  )
                  onClearMemberSelection()
                }}
                disabled={
                  memberPage >= totalMemberPages || teamMembersQuery.isFetching
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => teamMembersQuery.refetch()}
                disabled={teamMembersQuery.isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${teamMembersQuery.isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
          {canManage && selectedMemberIds.length > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {selectedMemberIds.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => mutations.bulkRemoveMembersMutation.mutate()}
                disabled={mutations.bulkRemoveMembersMutation.isPending}
              >
                Remove Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearMemberSelection}
              >
                Clear
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
