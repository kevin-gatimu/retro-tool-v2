import { Plus, X } from 'lucide-react'
import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ALL_FLAVOURS, FLAVOUR_LABELS } from '@/routes/icebreakers/helpers'
import { ICEBREAKER_FLAVOURS } from '@/common/enums/icebreaker.enums'
import type { TIcebreakerFlavour } from '@/common/enums/icebreaker.enums'
import type {
  CreateIcebreakerTemplateInput,
  IcebreakerTemplate,
} from '@/common/types/icebreakers'
import type { OrganizationAdminRow } from '../types'

type PromptDraft = {
  text: string
  color: string
}

/**
 * Create/edit dialog for icebreaker templates (admin-only). Owns its own form
 * state; the parent owns the mutation and passes the submit handler. Edit mode
 * is inferred from the presence of `template`.
 */
export function IcebreakerTemplateFormDialog({
  open,
  onClose,
  allOrgs,
  template,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  allOrgs: OrganizationAdminRow[]
  template?: IcebreakerTemplate
  onSubmit: (body: CreateIcebreakerTemplateInput) => void
  isPending: boolean
}) {
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [desc, setDesc] = useState(template?.description ?? '')
  const [orgId, setOrgId] = useState(template?.organizationId ?? '')
  const [flavour, setFlavour] = useState<TIcebreakerFlavour>(
    template?.flavour ?? ICEBREAKER_FLAVOURS.Fun,
  )
  const [color, setColor] = useState(template?.color ?? '#6366f1')
  const [prompts, setPrompts] = useState<PromptDraft[]>(
    template
      ? template.prompts
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((p) => ({ text: p.text, color: p.color ?? '' }))
      : [{ text: '', color: '' }],
  )

  const validPrompts = prompts.filter((p) => p.text.trim())
  const canSubmit = name.trim().length > 0 && validPrompts.length > 0

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: desc.trim() || undefined,
      flavour,
      organizationId: orgId || undefined,
      color: color || undefined,
      prompts: validPrompts.map((p, i) => ({
        text: p.text.trim(),
        order: i,
        color: p.color || undefined,
      })),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Icebreaker Template' : 'New Icebreaker Template'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the template prompts and settings.'
              : 'Create a new set of prompts for icebreaker sessions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team Warm-up"
                maxCharacters={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select
                value={orgId || 'none'}
                onValueChange={(v) => setOrgId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Global (all users)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global (all users)</SelectItem>
                  {allOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Flavour</Label>
              <Select
                value={flavour}
                onValueChange={(v) => setFlavour(v as TIcebreakerFlavour)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_FLAVOURS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FLAVOUR_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Theme Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {color}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="When to use this template"
              className="min-h-16 resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prompts *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={prompts.length >= 50}
                onClick={() =>
                  setPrompts((p) => [...p, { text: '', color: '' }])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Prompt
              </Button>
            </div>
            {prompts.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-1.5 pt-0.5">
                  <input
                    type="color"
                    value={p.color || '#6366f1'}
                    onChange={(e) =>
                      setPrompts((prev) =>
                        prev.map((pp, j) =>
                          j === i ? { ...pp, color: e.target.value } : pp,
                        ),
                      )
                    }
                    className="h-8 w-9 cursor-pointer rounded border border-input p-0.5"
                  />
                  {p.color && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-1.5 text-xs text-muted-foreground"
                      onClick={() =>
                        setPrompts((prev) =>
                          prev.map((pp, j) =>
                            j === i ? { ...pp, color: '' } : pp,
                          ),
                        )
                      }
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Prompt text"
                  value={p.text}
                  maxLength={500}
                  className="flex-1 min-h-9 resize-none"
                  rows={2}
                  onChange={(e) =>
                    setPrompts((prev) =>
                      prev.map((pp, j) =>
                        j === i ? { ...pp, text: e.target.value } : pp,
                      ),
                    )
                  }
                />
                {prompts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setPrompts((prev) => prev.filter((_, j) => j !== i))
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending
              ? isEdit
                ? 'Saving...'
                : 'Creating...'
              : isEdit
                ? 'Save Changes'
                : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
