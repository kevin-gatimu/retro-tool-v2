import { Badge } from '@/components/ui/badge'
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
import { FLAVOUR_ACCENTS, FLAVOUR_LABELS } from '@/routes/icebreakers/helpers'
import type { IcebreakerTemplate } from '@/common/types/icebreakers'

/**
 * Read-only detail dialog for an icebreaker template (admin-only). Presentational:
 * the parent owns the open/close state and the currently-viewed template.
 */
export function IcebreakerTemplateViewDialog({
  template,
  open,
  onClose,
}: {
  template: IcebreakerTemplate | null
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template?.name}
            {template?.isBuiltIn ? (
              <Badge variant="secondary" className="text-xs">
                Built-in
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {template?.organizationName ?? 'Org'}
              </Badge>
            )}
            {template && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FLAVOUR_ACCENTS[template.flavour]}`}
              >
                {FLAVOUR_LABELS[template.flavour]}
              </span>
            )}
          </DialogTitle>
          {template?.description && (
            <DialogDescription>{template.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-2">
          {template?.color && (
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: template.color }}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {template.color}
              </span>
            </div>
          )}
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">
              PROMPTS ({template?.prompts.length ?? 0})
            </Label>
            <div className="grid gap-2">
              {template?.prompts
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    {p.color && (
                      <div
                        className="mt-0.5 h-3 w-3 rounded-full border shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                    <p className="flex-1 min-w-0 text-sm">{p.text}</p>
                  </div>
                ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Created:{' '}
            {template?.createdAt
              ? new Date(template.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : '—'}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
