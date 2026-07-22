import { Check, UserPlus } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
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
import type { Organization } from '@/common/types/organizations'
import type { User } from '@/common/types/users'
import type { TeamMutations, TeamRoleSelection } from '../types'

type OrgMember = NonNullable<Organization['members']>[number]

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberSearch: string
  onMemberSearchChange: (value: string) => void
  onClearSelection: () => void
  isSearching: boolean
  availableMembers: OrgMember[]
  filteredSearchResults: User[]
  addMemberUserIds: string[]
  onToggleSelection: (userId: string) => void
  addMemberRole: TeamRoleSelection
  onAddMemberRoleChange: (value: TeamRoleSelection) => void
  addMemberMutation: TeamMutations['addMemberMutation']
}

export function AddMemberDialog({
  open,
  onOpenChange,
  memberSearch,
  onMemberSearchChange,
  onClearSelection,
  isSearching,
  availableMembers,
  filteredSearchResults,
  addMemberUserIds,
  onToggleSelection,
  addMemberRole,
  onAddMemberRoleChange,
  addMemberMutation,
}: AddMemberDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          onMemberSearchChange('')
          onClearSelection()
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
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Select one or more users to add to this team. Team Rank will be
            applied to all selected users.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="memberSearch">Search User</Label>
            <Input
              id="memberSearch"
              placeholder="Type name or email to search..."
              value={memberSearch}
              onChange={(e) => onMemberSearchChange(e.target.value)}
            />
            {isSearching && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}
          </div>

          {/* Quick add from org members */}
          {memberSearch.length < 2 && availableMembers.length > 0 && (
            <div className="grid gap-2">
              <Label>Organization Members</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {availableMembers.map((om) => (
                  <div
                    key={om.userId}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                      addMemberUserIds.includes(om.userId) ? 'bg-muted' : ''
                    }`}
                    onClick={() => onToggleSelection(om.userId)}
                  >
                    <UserAvatar
                      image={om.user.image}
                      name={om.user.name}
                      userId={om.userId}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {om.user.name ?? om.user.email}
                      </p>
                      {om.user.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {om.user.email}
                        </p>
                      )}
                    </div>
                    {addMemberUserIds.includes(om.userId) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {memberSearch.length >= 2 && filteredSearchResults.length > 0 && (
            <div className="grid gap-2">
              <Label>Search Results</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {filteredSearchResults.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                      addMemberUserIds.includes(u.id) ? 'bg-muted' : ''
                    }`}
                    onClick={() => onToggleSelection(u.id)}
                  >
                    <UserAvatar
                      image={u.image}
                      name={u.name}
                      userId={u.id}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      )}
                    </div>
                    {addMemberUserIds.includes(u.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {memberSearch.length >= 2 &&
            !isSearching &&
            filteredSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found matching "{memberSearch}"
              </p>
            )}

          <div className="grid gap-2">
            <Label htmlFor="role">Team Rank</Label>
            <Select
              value={addMemberRole}
              onValueChange={(v: string) =>
                onAddMemberRoleChange(v as TeamRoleSelection)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="team-lead">Team Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {addMemberUserIds.length} user(s) selected with rank:{' '}
            {addMemberRole === 'team-lead' ? 'Team Lead' : 'Member'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              addMemberMutation.mutate({
                userIds: addMemberUserIds,
                role: addMemberRole,
              })
            }
            disabled={
              addMemberUserIds.length === 0 || addMemberMutation.isPending
            }
          >
            {addMemberMutation.isPending
              ? 'Adding...'
              : `Add ${addMemberUserIds.length || ''}${
                  addMemberUserIds.length ? ' Member(s)' : ''
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
