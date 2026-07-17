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
import type { TemplateWithColumns } from '../types'

/**
 * Read-only detail dialog for a retro template (admin), showing its columns.
 * Presentational: the parent owns the open/close state and the viewed template.
 */
export function RetroTemplateViewDialog({
  template,
  open,
  onClose,
}: {
  template: TemplateWithColumns | null
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
          </DialogTitle>
          {template?.description && (
            <DialogDescription>{template.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">
              COLUMNS ({template?.columns.length ?? 0})
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {template?.columns
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((col) => (
                  <div
                    key={col.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    {col.emoji && <span className="text-2xl">{col.emoji}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{col.name}</p>
                      {col.prompt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {col.prompt}
                        </p>
                      )}
                    </div>
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
