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
import { toSlug } from '../../helpers'
import type { OrgDetailMutations } from '../../types'

interface EditOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editName: string
  onEditNameChange: (value: string) => void
  editSlug: string
  onEditSlugChange: (value: string) => void
  editLogo: string
  onEditLogoChange: (value: string) => void
  updateOrgMutation: OrgDetailMutations['updateOrgMutation']
}

export function EditOrgDialog({
  open,
  onOpenChange,
  editName,
  onEditNameChange,
  editSlug,
  onEditSlugChange,
  editLogo,
  onEditLogoChange,
  updateOrgMutation,
}: EditOrgDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update your organization details.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (editName && !updateOrgMutation.isPending)
              updateOrgMutation.mutate(
                {
                  name: editName,
                  slug: editSlug,
                  logo: editLogo,
                },
                { onSuccess: () => onOpenChange(false) },
              )
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => {
                  onEditNameChange(e.target.value)
                  onEditSlugChange(toSlug(e.target.value))
                }}
              />
              <p className="text-xs text-muted-foreground">
                URL slug:{' '}
                <span className="font-mono text-foreground">
                  /{editSlug || toSlug(editName)}
                </span>
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editLogo">Logo URL</Label>
              <Input
                id="editLogo"
                placeholder="https://example.com/logo.png"
                value={editLogo}
                onChange={(e) => onEditLogoChange(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!editName || updateOrgMutation.isPending}
            >
              {updateOrgMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
