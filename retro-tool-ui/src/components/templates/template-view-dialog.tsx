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
import {
  TShirtIcon,
  getShirtScale,
  isTShirtTemplateName,
} from '@/components/t-shirt-icon'
import type { EstimateTemplate } from '@/common/types/estimates'

/**
 * Read-only detail dialog for a story estimate template. Renders t-shirt icons
 * for t-shirt-style templates and a colored value grid otherwise. Presentational:
 * the parent owns the open/close state and the currently-viewed template.
 */
export function TemplateViewDialog({
  template,
  open,
  onClose,
}: {
  template: EstimateTemplate | null
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
              VALUES ({template?.values.length ?? 0})
            </Label>
            {template && isTShirtTemplateName(template.name) ? (
              <div className="flex flex-wrap gap-3">
                {template.values
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="flex flex-col items-center gap-1.5 rounded-lg border p-3 w-28"
                    >
                      <div className="w-24 h-24">
                        <TShirtIcon
                          label={v.label}
                          themeColor={template.color ?? '#f43f5e'}
                          selected={false}
                          scale={getShirtScale(v.label)}
                        />
                      </div>
                      {v.value !== v.label && (
                        <span className="text-xs text-muted-foreground font-mono">
                          = {v.value}
                        </span>
                      )}
                      {v.description && (
                        <p className="text-xs text-muted-foreground text-center line-clamp-2">
                          {v.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {template?.values
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      {v.color && (
                        <div
                          className="mt-0.5 h-3 w-3 rounded-full border shrink-0"
                          style={{ backgroundColor: v.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold text-sm"
                            style={{
                              color: v.color ?? template.color ?? '#6366f1',
                            }}
                          >
                            {v.label}
                          </span>
                          {v.value !== v.label && (
                            <span className="text-xs text-muted-foreground font-mono">
                              = {v.value}
                            </span>
                          )}
                        </div>
                        {v.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {v.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
