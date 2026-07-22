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
import { EmojiPicker } from '@/components/ui/emoji-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TeamMutations } from '../types'

interface EditTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editName: string
  onEditNameChange: (value: string) => void
  editDescription: string
  onEditDescriptionChange: (value: string) => void
  editEmoji: string
  onEditEmojiChange: (value: string) => void
  updateMutation: TeamMutations['updateMutation']
}

export function EditTeamDialog({
  open,
  onOpenChange,
  editName,
  onEditNameChange,
  editDescription,
  onEditDescriptionChange,
  editEmoji,
  onEditEmojiChange,
  updateMutation,
}: EditTeamDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>Update your team details.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (editName && !updateMutation.isPending) updateMutation.mutate()
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editEmoji">Emoji</Label>
              <EmojiPicker
                value={editEmoji}
                onSelect={(emoji) => onEditEmojiChange(emoji)}
                ariaLabel="Team emoji"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => onEditDescriptionChange(e.target.value)}
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
              disabled={!editName || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
