import type { Dispatch, SetStateAction } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { TemplateColumnDraft } from '../../types'

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTemplateId: string | null
  tplName: string
  onTplNameChange: (value: string) => void
  tplDescription: string
  onTplDescriptionChange: (value: string) => void
  tplColumns: TemplateColumnDraft[]
  onTplColumnsChange: Dispatch<SetStateAction<TemplateColumnDraft[]>>
  sortedTplColumns: TemplateColumnDraft[]
  tplFormError: string | null
  onCancel: () => void
  onSubmit: () => void
  isSaving: boolean
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplateId,
  tplName,
  onTplNameChange,
  tplDescription,
  onTplDescriptionChange,
  tplColumns,
  onTplColumnsChange,
  sortedTplColumns,
  tplFormError,
  onCancel,
  onSubmit,
  isSaving,
}: TemplateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingTemplateId ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            Configure template details and columns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={tplName}
              onChange={(e) => onTplNameChange(e.target.value)}
              placeholder="Start / Stop / Continue"
              maxCharacters={40}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={tplDescription}
              onChange={(e) => onTplDescriptionChange(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onTplColumnsChange((c) => [
                    ...c,
                    { name: '', emoji: '', prompt: '', order: c.length },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Column
              </Button>
            </div>
            {sortedTplColumns.map((column, index) => (
              <Card key={`tpl-col-${index}`}>
                <CardContent className="grid gap-3 p-4">
                  <div className="grid gap-3 md:grid-cols-[90px_1fr]">
                    <div className="space-y-1">
                      <Label>Emoji</Label>
                      <EmojiPicker
                        value={column.emoji}
                        onSelect={(emoji) =>
                          onTplColumnsChange((c) => {
                            const n = [...c]
                            n[index] = { ...n[index], emoji }
                            return n
                          })
                        }
                        ariaLabel={`Emoji for column ${index + 1}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        value={column.name}
                        onChange={(e) =>
                          onTplColumnsChange((c) => {
                            const n = [...c]
                            n[index] = { ...n[index], name: e.target.value }
                            return n
                          })
                        }
                        placeholder="What went well"
                        maxCharacters={40}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Prompt (optional)</Label>
                    <Textarea
                      value={column.prompt}
                      onChange={(e) =>
                        onTplColumnsChange((c) => {
                          const n = [...c]
                          n[index] = { ...n[index], prompt: e.target.value }
                          return n
                        })
                      }
                      rows={2}
                      placeholder="Guide for this column"
                    />
                  </div>
                  {tplColumns.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() =>
                          onTplColumnsChange((c) =>
                            c.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {tplFormError && (
            <p className="text-sm text-destructive">{tplFormError}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
