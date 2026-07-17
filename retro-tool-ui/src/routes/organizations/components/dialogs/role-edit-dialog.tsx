import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OrgTeamRoleMutations, RoleEditTarget } from '../../types'

interface RoleEditDialogProps {
  roleEditTarget: RoleEditTarget
  onClose: () => void
  roleFormName: string
  onRoleFormNameChange: (value: string) => void
  roleFormSortOrder: number
  onRoleFormSortOrderChange: (value: number) => void
  updateCustomRoleMutation: OrgTeamRoleMutations['updateCustomRoleMutation']
}

export function RoleEditDialog({
  roleEditTarget,
  onClose,
  roleFormName,
  onRoleFormNameChange,
  roleFormSortOrder,
  onRoleFormSortOrderChange,
  updateCustomRoleMutation,
}: RoleEditDialogProps) {
  return (
    <Dialog
      open={roleEditTarget !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Custom Role</DialogTitle>
          <DialogDescription>Update this organisation role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={roleFormName}
              onChange={(e) => onRoleFormNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sort Order</Label>
            <Input
              type="number"
              value={roleFormSortOrder}
              onChange={(e) =>
                onRoleFormSortOrderChange(Number(e.target.value))
              }
              min={0}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !roleFormName.trim() || updateCustomRoleMutation.isPending
            }
            onClick={() => {
              if (!roleEditTarget) return
              updateCustomRoleMutation.mutate(
                {
                  id: roleEditTarget.id,
                  payload: {
                    name: roleFormName.trim(),
                    sortOrder: roleFormSortOrder,
                  },
                },
                { onSuccess: () => onClose() },
              )
            }}
          >
            {updateCustomRoleMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
