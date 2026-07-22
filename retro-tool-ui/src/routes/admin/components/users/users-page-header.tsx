import { Ban, Building2, UserCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UsersPageHeaderProps {
  viewerIsSystemAdmin: boolean
  selectedCount: number
  onBulkApprove: () => void
  onBulkSuspend: () => void
  onBulkAddOrg: () => void
  onBulkAddTeam: () => void
  onClearSelection: () => void
}

export function UsersPageHeader({
  viewerIsSystemAdmin,
  selectedCount,
  onBulkApprove,
  onBulkSuspend,
  onBulkAddOrg,
  onBulkAddTeam,
  onClearSelection,
}: UsersPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {viewerIsSystemAdmin ? 'User Management' : 'Organization Members'}
        </h1>
        <p className="text-muted-foreground">
          {viewerIsSystemAdmin
            ? 'Manage user accounts, permissions, and access'
            : 'View members in your organizations'}
        </p>
      </div>
      {viewerIsSystemAdmin && selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button size="sm" variant="outline" onClick={onBulkApprove}>
            <UserCheck className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkSuspend}>
            <Ban className="mr-1 h-4 w-4" />
            Suspend
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkAddOrg}>
            <Building2 className="mr-1 h-4 w-4" />
            Add to Org
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkAddTeam}>
            <Users className="mr-1 h-4 w-4" />
            Add to Team
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
