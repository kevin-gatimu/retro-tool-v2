import type { Dispatch, SetStateAction } from 'react'
import { Mail, UserPlus } from 'lucide-react'
import { getOrgMemberColumns } from '@/components/tables/member-columns'
import type { OrgMemberRow } from '@/components/tables/member-columns'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterPills } from '@/components/ui/filter-pills'
import { TabsContent } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import {
  inviteEmailCheckColorClass,
  inviteEmailCheckMessage,
} from '@/common/helpers'
import type { OrganizationDetail } from '@/common/types/organizations'
import type {
  useBulkRemoveMembers,
  useOrgDetailMutations,
  useUserSearch,
} from '../../hooks'
import { OrgInvitationsSection } from '../org-invitations-section'
import type { InviteEmailCheckState, OrgMemberRoleSelection } from '../../types'

interface MembersTabProps {
  orgId: string
  isAdmin: boolean
  isOwner: boolean
  orgMembers: OrganizationDetail['members']
  filteredOrgMembers: OrganizationDetail['members']
  memberFilter: 'all' | 'unassigned'
  onMemberFilterChange: (value: 'all' | 'unassigned') => void
  isInviteOpen: boolean
  onInviteOpenChange: (open: boolean) => void
  inviteEmail: string
  onInviteEmailChange: (value: string) => void
  inviteRole: OrgMemberRoleSelection
  onInviteRoleChange: (value: OrgMemberRoleSelection) => void
  inviteEmailCheck: InviteEmailCheckState
  onInviteEmailCheckChange: (value: InviteEmailCheckState) => void
  inviteOrgMemberMutation: ReturnType<
    typeof useOrgDetailMutations
  >['inviteOrgMemberMutation']
  isAddMemberOpen: boolean
  onAddMemberOpenChange: (open: boolean) => void
  addMemberSearch: string
  onAddMemberSearchChange: (value: string) => void
  addMemberUserId: string
  onAddMemberUserIdChange: (value: string) => void
  addMemberRole: OrgMemberRoleSelection
  onAddMemberRoleChange: (value: OrgMemberRoleSelection) => void
  userSearchQuery: ReturnType<typeof useUserSearch>
  addOrgMemberMutation: ReturnType<
    typeof useOrgDetailMutations
  >['addOrgMemberMutation']
  updateRoleMutation: ReturnType<
    typeof useOrgDetailMutations
  >['updateRoleMutation']
  onRemoveMember: (userId: string) => void
  memberRowSelection: Record<string, boolean>
  onRowSelectionChange: Dispatch<SetStateAction<Record<string, boolean>>>
  selectedMemberIds: string[]
  bulkRemoveMembersMutation: ReturnType<typeof useBulkRemoveMembers>
  onRefreshMembers: () => void
}

export function MembersTab({
  orgId,
  isAdmin,
  isOwner,
  orgMembers,
  filteredOrgMembers,
  memberFilter,
  onMemberFilterChange,
  isInviteOpen,
  onInviteOpenChange,
  inviteEmail,
  onInviteEmailChange,
  inviteRole,
  onInviteRoleChange,
  inviteEmailCheck,
  onInviteEmailCheckChange,
  inviteOrgMemberMutation,
  isAddMemberOpen,
  onAddMemberOpenChange,
  addMemberSearch,
  onAddMemberSearchChange,
  addMemberUserId,
  onAddMemberUserIdChange,
  addMemberRole,
  onAddMemberRoleChange,
  userSearchQuery,
  addOrgMemberMutation,
  updateRoleMutation,
  onRemoveMember,
  memberRowSelection,
  onRowSelectionChange,
  selectedMemberIds,
  bulkRemoveMembersMutation,
  onRefreshMembers,
}: MembersTabProps) {
  return (
    <TabsContent value="members" className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">
            Members ({filteredOrgMembers.length})
          </h2>
          <FilterPills
            ariaLabel="Filter members"
            value={memberFilter}
            onChange={(v) => onMemberFilterChange(v)}
            options={[
              {
                value: 'all',
                label: 'All members',
                description: 'Everyone in this organization',
              },
              {
                value: 'unassigned',
                label: 'Unassigned',
                description: 'Members not assigned to any team',
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              {/* Invite by Email */}
              <Dialog
                open={isInviteOpen}
                onOpenChange={(open) => {
                  onInviteOpenChange(open)
                  if (!open) {
                    onInviteEmailChange('')
                    onInviteRoleChange('member')
                    onInviteEmailCheckChange(null)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Mail className="mr-2 h-4 w-4" />
                    Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Member by Email</DialogTitle>
                    <DialogDescription>
                      Send an invitation email. Works for both registered and
                      new users.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (inviteEmail && !inviteOrgMemberMutation.isPending)
                        inviteOrgMemberMutation.mutate(
                          { email: inviteEmail, role: inviteRole },
                          {
                            onSuccess: () => {
                              onInviteOpenChange(false)
                              onInviteEmailChange('')
                              onInviteRoleChange('member')
                              onInviteEmailCheckChange(null)
                            },
                          },
                        )
                    }}
                  >
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => {
                            onInviteEmailChange(e.target.value)
                            onInviteEmailCheckChange(null)
                          }}
                          onBlur={async () => {
                            if (!inviteEmail) return
                            try {
                              const result = await api.get<{
                                registered: boolean
                                name?: string
                                isMember?: boolean
                              }>(
                                `${ORGANIZATIONS_ENDPOINTS.CHECK_INVITE_EMAIL(orgId)}?email=${encodeURIComponent(inviteEmail)}`,
                              )
                              onInviteEmailCheckChange(result)
                            } catch {
                              onInviteEmailCheckChange(null)
                            }
                          }}
                        />
                        {inviteEmailCheck !== null && (
                          <p
                            className={`text-xs ${inviteEmailCheckColorClass(inviteEmailCheck)}`}
                          >
                            {inviteEmailCheckMessage(
                              inviteEmailCheck,
                              'organisation',
                            )}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(v: string) =>
                            onInviteRoleChange(v as OrgMemberRoleSelection)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="org-admin">
                              Admin (Org)
                            </SelectItem>
                            {isOwner && (
                              <SelectItem value="org-owner">
                                Owner (Org)
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onInviteOpenChange(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          !inviteEmail ||
                          inviteOrgMemberMutation.isPending ||
                          !!inviteEmailCheck?.isMember
                        }
                      >
                        {inviteOrgMemberMutation.isPending
                          ? 'Sending...'
                          : 'Send Invite'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Add Member directly */}
              <Dialog
                open={isAddMemberOpen}
                onOpenChange={(open) => {
                  onAddMemberOpenChange(open)
                  if (!open) {
                    onAddMemberSearchChange('')
                    onAddMemberUserIdChange('')
                    onAddMemberRoleChange('member')
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Member</DialogTitle>
                    <DialogDescription>
                      Directly add an existing user without sending an email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Search user</Label>
                      <Input
                        placeholder="Name or email…"
                        value={addMemberSearch}
                        onChange={(e) => {
                          onAddMemberSearchChange(e.target.value)
                          onAddMemberUserIdChange('')
                        }}
                      />
                      {userSearchQuery.data &&
                        userSearchQuery.data.length > 0 &&
                        !addMemberUserId && (
                          <div className="border border-[#30363d] rounded-md divide-y divide-[#30363d] max-h-40 overflow-y-auto">
                            {userSearchQuery.data
                              .filter(
                                (u) =>
                                  !orgMembers.some((m) => m.userId === u.id),
                              )
                              .map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#21262d] flex items-center gap-2"
                                  onClick={() => {
                                    onAddMemberUserIdChange(u.id)
                                    onAddMemberSearchChange(u.name)
                                  }}
                                >
                                  <span className="font-medium text-white">
                                    {u.name}
                                  </span>
                                  <span className="text-gray-400">
                                    {u.email}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      {addMemberUserId && (
                        <p className="text-xs text-emerald-400">
                          User selected
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Role</Label>
                      <Select
                        value={addMemberRole}
                        onValueChange={(v: string) =>
                          onAddMemberRoleChange(v as OrgMemberRoleSelection)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="org-admin">Admin (Org)</SelectItem>
                          {isOwner && (
                            <SelectItem value="org-owner">
                              Owner (Org)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => onAddMemberOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={
                        !addMemberUserId || addOrgMemberMutation.isPending
                      }
                      onClick={() =>
                        addOrgMemberMutation.mutate(
                          { userId: addMemberUserId, role: addMemberRole },
                          { onSuccess: () => onAddMemberOpenChange(false) },
                        )
                      }
                    >
                      {addOrgMemberMutation.isPending
                        ? 'Adding...'
                        : 'Add Member'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <DataTable
        columns={getOrgMemberColumns({
          isAdmin: !!isAdmin,
          onUpdateRole: (userId, role) =>
            updateRoleMutation.mutate({ userId, role }),
          onRemove: (userId) => onRemoveMember(userId),
        })}
        data={filteredOrgMembers as OrgMemberRow[]}
        searchColumn="user"
        searchPlaceholder="Search members..."
        pagination
        defaultPageSize={10}
        selectable={isAdmin}
        rowSelection={memberRowSelection}
        onRowSelectionChange={onRowSelectionChange}
        getRowId={(row) => row.userId}
        onRefresh={onRefreshMembers}
      />
      {isAdmin && selectedMemberIds.length > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedMemberIds.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => bulkRemoveMembersMutation.mutate()}
            disabled={bulkRemoveMembersMutation.isPending}
          >
            Remove Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRowSelectionChange({})}
          >
            Clear
          </Button>
        </div>
      )}

      {isAdmin && <OrgInvitationsSection orgId={orgId} />}
    </TabsContent>
  )
}
