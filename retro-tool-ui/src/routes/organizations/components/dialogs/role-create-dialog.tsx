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
import type { OrgTeamRoleMutations } from '../../types'

interface RoleCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleFormName: string
  onRoleFormNameChange: (value: string) => void
  roleFormSortOrder: number
  onRoleFormSortOrderChange: (value: number) => void
  createCustomRoleMutation: OrgTeamRoleMutations['createCustomRoleMutation']
}

export function RoleCreateDialog({
  open,
  onOpenChange,
  roleFormName,
  onRoleFormNameChange,
  roleFormSortOrder,
  onRoleFormSortOrderChange,
  createCustomRoleMutation,
}: RoleCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Custom Role</DialogTitle>
          <DialogDescription>
            This role will only be available within this organisation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={roleFormName}
              onChange={(e) => onRoleFormNameChange(e.target.value)}
              placeholder="e.g. Release Manager"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !roleFormName.trim() || createCustomRoleMutation.isPending
            }
            onClick={() => {
              createCustomRoleMutation.mutate(
                { name: roleFormName.trim(), sortOrder: roleFormSortOrder },
                { onSuccess: () => onOpenChange(false) },
              )
            }}
          >
            {createCustomRoleMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
