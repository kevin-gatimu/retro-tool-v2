import { Plus, X } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Organization } from '@/common/types/organizations'
import type { ColumnDraft } from '../types'

/**
 * Create-retro-template dialog for the `/templates` page. Presentational: the
 * parent owns all form state, the columns array, the create mutation, and the
 * org lists; this component renders the form and forwards user input via setters.
 */
export function CreateRetroTemplateDialog({
  open,
  onOpenChange,
  sysAdmin,
  orgs,
  adminOrgs,
  name,
  onNameChange,
  desc,
  onDescChange,
  orgId,
  onOrgIdChange,
  columns,
  onColumnsChange,
  onCancel,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sysAdmin: boolean
  orgs: Organization[]
  adminOrgs: Organization[]
  name: string
  onNameChange: (v: string) => void
  desc: string
  onDescChange: (v: string) => void
  orgId: string
  onOrgIdChange: (v: string) => void
  columns: ColumnDraft[]
  onColumnsChange: (updater: (cols: ColumnDraft[]) => ColumnDraft[]) => void
  onCancel: () => void
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Add a custom retrospective template for your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. Team Health Check"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxCharacters={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="What is this template for?"
              value={desc}
              onChange={(e) => onDescChange(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>

          {sysAdmin ? (
            <div className="space-y-1.5">
              <Label>Organization (optional)</Label>
              <Select
                value={orgId || '__global__'}
                onValueChange={(v) =>
                  onOrgIdChange(v === '__global__' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Global (all users)</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            adminOrgs.length > 0 && (
              <div className="space-y-1.5">
                <Label>Organization *</Label>
                <Select value={orgId} onValueChange={onOrgIdChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Columns *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onColumnsChange((c) => [
                    ...c,
                    { name: '', emoji: '', prompt: '' },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Column
              </Button>
            </div>
            {columns.map((col, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <EmojiPicker
                      value={col.emoji}
                      onSelect={(emoji) =>
                        onColumnsChange((c) =>
                          c.map((cc, j) => (j === i ? { ...cc, emoji } : cc)),
                        )
                      }
                      ariaLabel={`Emoji for column ${i + 1}`}
                    />
                    <Input
                      placeholder="Column name *"
                      value={col.name}
                      maxCharacters={40}
                      onChange={(e) =>
                        onColumnsChange((c) =>
                          c.map((cc, j) =>
                            j === i ? { ...cc, name: e.target.value } : cc,
                          ),
                        )
                      }
                    />
                  </div>
                  <Input
                    placeholder="Prompt (optional)"
                    value={col.prompt}
                    onChange={(e) =>
                      onColumnsChange((c) =>
                        c.map((cc, j) =>
                          j === i ? { ...cc, prompt: e.target.value } : cc,
                        ),
                      )
                    }
                  />
                </div>
                {columns.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mt-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      onColumnsChange((c) => c.filter((_, j) => j !== i))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              isPending ||
              !name.trim() ||
              columns.filter((c) => c.name.trim()).length === 0 ||
              (!sysAdmin && !orgId)
            }
          >
            {isPending ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
