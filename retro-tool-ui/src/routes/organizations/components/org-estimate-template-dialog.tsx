import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { ESTIMATE_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateEstimateTemplateInput,
  EstimateTemplate,
} from '@/common/types/estimates'
import type { EstimateValueDraft } from '../types'

export function OrgEstimateTemplateDialog({
  open,
  onClose,
  orgId,
  template,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  orgId: string
  template?: EstimateTemplate
  onSuccess: () => void
}) {
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [desc, setDesc] = useState(template?.description ?? '')
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

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: desc.trim() || (isEdit ? null : undefined),
        color: color || (isEdit ? null : undefined),
        values: values
          .filter((v) => v.label.trim() && v.value.trim())
          .map((v, i) => ({
            label: v.label.trim(),
            value: v.value.trim(),
            order: i,
            color: v.color || (isEdit ? null : undefined),
            description: v.description.trim() || (isEdit ? null : undefined),
          })),
      }
      if (template) {
        return api.patch(
          ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(template.id),
          payload,
        )
      }
      return api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, {
        ...(payload as CreateEstimateTemplateInput),
        organizationId: orgId,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Template updated' : 'Template created')
      onSuccess()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save template'),
  })

  const validValues = values.filter((v) => v.label.trim() && v.value.trim())
  const canSubmit = name.trim().length > 0 && validValues.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Estimate Template' : 'New Estimate Template'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the template values and settings.'
              : 'Define a custom voting scale for estimation sessions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint Estimation"
              maxCharacters={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="min-h-16 resize-none"
              placeholder="When to use this template"
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
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Label = displayed. Value = stored in votes (use numbers for
              stats).
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
                      maxCharacters={20}
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
                      maxCharacters={20}
                      onChange={(e) =>
                        setValues((vals) =>
                          vals.map((vv, j) =>
                            j === i ? { ...vv, value: e.target.value } : vv,
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
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending
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
