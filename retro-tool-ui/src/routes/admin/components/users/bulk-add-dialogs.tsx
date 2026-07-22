import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { useBulkOrgTeamMutations } from '../../hooks'

type BulkMutations = ReturnType<typeof useBulkOrgTeamMutations>
type OrgOption = { id: string; name: string }
type TeamOption = { id: string; name: string }

interface BulkAddOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  orgs: OrgOption[]
  bulkTargetOrgId: string
  onBulkTargetOrgIdChange: (value: string) => void
  bulkAddToOrgMutation: BulkMutations['bulkAddToOrgMutation']
}

export function BulkAddOrgDialog({
  open,
  onOpenChange,
  selectedCount,
  orgs,
  bulkTargetOrgId,
  onBulkTargetOrgIdChange,
  bulkAddToOrgMutation,
}: BulkAddOrgDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {selectedCount} user(s) to Organisation</DialogTitle>
          <DialogDescription>Select the target organisation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Organisation</Label>
          <Select
            value={bulkTargetOrgId}
            onValueChange={onBulkTargetOrgIdChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select organisation…" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => bulkAddToOrgMutation.mutate()}
            disabled={!bulkTargetOrgId || bulkAddToOrgMutation.isPending}
          >
            {bulkAddToOrgMutation.isPending ? 'Adding…' : 'Add to Organisation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface BulkAddTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  orgs: OrgOption[]
  teams: TeamOption[]
  bulkTargetOrgId: string
  onBulkTargetOrgIdChange: (value: string) => void
  bulkTargetTeamId: string
  onBulkTargetTeamIdChange: (value: string) => void
  bulkAddToTeamMutation: BulkMutations['bulkAddToTeamMutation']
}

export function BulkAddTeamDialog({
  open,
  onOpenChange,
  selectedCount,
  orgs,
  teams,
  bulkTargetOrgId,
  onBulkTargetOrgIdChange,
  bulkTargetTeamId,
  onBulkTargetTeamIdChange,
  bulkAddToTeamMutation,
}: BulkAddTeamDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {selectedCount} user(s) to Team</DialogTitle>
          <DialogDescription>
            Select the organisation, then the team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Organisation</Label>
            <Select
              value={bulkTargetOrgId}
              onValueChange={(v) => {
                onBulkTargetOrgIdChange(v)
                onBulkTargetTeamIdChange('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organisation…" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bulkTargetOrgId && (
            <div className="space-y-1">
              <Label>Team</Label>
              <Select
                value={bulkTargetTeamId}
                onValueChange={onBulkTargetTeamIdChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => bulkAddToTeamMutation.mutate()}
            disabled={!bulkTargetTeamId || bulkAddToTeamMutation.isPending}
          >
            {bulkAddToTeamMutation.isPending ? 'Adding…' : 'Add to Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
