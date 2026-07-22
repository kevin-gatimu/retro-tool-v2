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
import type {
  EstimateTemplate,
  EstimateValueDraft,
} from '@/common/types/estimates'

/** Minimal org shape needed by the org selector (matches Organization + admin rows). */
export interface EstimateFormOrgOption {
  id: string
  name: string
}

/**
 * Normalized, trimmed form output. Only values with a non-empty label AND value
 * are included. Parents map this to their exact API payload (choosing null vs
 * undefined for cleared optional fields).
 */
export interface EstimateTemplateDraft {
  name: string
  description: string
  organizationId: string
  color: string
  values: EstimateValueDraft[]
}

/** Org-selector configuration. Omit to hide the selector entirely (e.g. edit-only forms). */
export interface EstimateFormOrgSelect {
  orgs: EstimateFormOrgOption[]
  /** Show the "Global (all users)" option (system admins). */
  allowGlobal: boolean
  /** Require an organization selection before submit. */
  required: boolean
  /** Initial selected org id (empty string = none/global). */
  initialOrgId?: string
}

/**
 * Shared create/edit dialog for story estimate templates. Presentational: owns
 * only local form state and emits a normalized draft via `onSubmit`. The parent
 * owns the mutation and builds the final API payload. Edit mode is inferred from
 * the presence of `template`.
 */
export function EstimateTemplateFormDialog({
  open,
  onClose,
  template,
  orgSelect,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  template?: EstimateTemplate
  orgSelect?: EstimateFormOrgSelect
  onSubmit: (draft: EstimateTemplateDraft) => void
  isPending: boolean
}) {
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [desc, setDesc] = useState(template?.description ?? '')
  const [orgId, setOrgId] = useState(
    template?.organizationId ?? orgSelect?.initialOrgId ?? '',
  )
  const [color, setColor] = useState(template?.color ?? '#6366f1')
  const [values, setValues] = useState<EstimateValueDraft[]>(
    template
      ? template.values
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((v) => ({
            label: v.label,
            value: v.value,
            color: v.color ?? '',
            description: v.description ?? '',
          }))
      : [{ label: '', value: '', color: '', description: '' }],
  )

  const validValues = values.filter((v) => v.label.trim() && v.value.trim())
  const canSubmit =
    name.trim().length > 0 &&
    validValues.length > 0 &&
    (!orgSelect?.required || !!orgId)

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: desc.trim(),
      organizationId: orgId,
      color,
      values: validValues.map((v) => ({
        label: v.label.trim(),
        value: v.value.trim(),
        color: v.color,
        description: v.description.trim(),
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
            {isEdit ? 'Edit Estimate Template' : 'New Estimate Template'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the template values and settings.'
              : 'Create a new voting scale for estimation sessions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fibonacci"
              />
            </div>
            {orgSelect && (
              <div className="space-y-1.5">
                <Label>
                  {orgSelect.required ? 'Organization *' : 'Organization'}
                </Label>
                {orgSelect.allowGlobal ? (
                  <Select
                    value={orgId || 'none'}
                    onValueChange={(v) => setOrgId(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Global (all users)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Global (all users)</SelectItem>
                      {orgSelect.orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgSelect.orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Values *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={values.length >= 30}
                onClick={() =>
                  setValues((v) => [
                    ...v,
                    { label: '', value: '', color: '', description: '' },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Value
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Label = displayed in voting. Value = stored in votes (use numbers
              for stats compatibility).
            </p>
            {values.map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      placeholder="XS"
                      value={v.label}
                      maxLength={20}
                      onChange={(e) =>
                        setValues((vals) =>
                          vals.map((vv, j) =>
                            j === i ? { ...vv, label: e.target.value } : vv,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      placeholder="1"
                      value={v.value}
                      maxLength={20}
                      onChange={(e) =>
                        setValues((vals) =>
                          vals.map((vv, j) =>
                            j === i ? { ...vv, value: e.target.value } : vv,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={v.color || '#6366f1'}
                        onChange={(e) =>
                          setValues((vals) =>
                            vals.map((vv, j) =>
                              j === i ? { ...vv, color: e.target.value } : vv,
                            ),
                          )
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-input p-0.5"
                      />
                      {v.color && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          onClick={() =>
                            setValues((vals) =>
                              vals.map((vv, j) =>
                                j === i ? { ...vv, color: '' } : vv,
                              ),
                            )
                          }
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Optional tooltip"
                      value={v.description}
                      onChange={(e) =>
                        setValues((vals) =>
                          vals.map((vv, j) =>
                            j === i
                              ? { ...vv, description: e.target.value }
                              : vv,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                {values.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mt-5 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setValues((vals) => vals.filter((_, j) => j !== i))
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
