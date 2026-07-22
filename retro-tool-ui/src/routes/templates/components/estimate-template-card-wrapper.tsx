import { Eye, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { EstimateTemplate } from '../types'

/**
 * Estimate template card for the `/templates` page, with a View button and an
 * inline confirm-delete flow. Kept distinct from the shared
 * `@/components/estimate-template-card.tsx` (which has style-based value
 * rendering, direct delete, and no View button) to preserve behavior.
 * Presentational: the parent owns the view/edit/delete handlers.
 */
export function EstimateTemplateCardWrapper({
  template,
  canManage,
  onView,
  onEdit,
  onDelete,
  deleting,
}: {
  template: EstimateTemplate
  canManage: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const themeColor = template.color ?? '#6366f1'

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {template.name}
            </p>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {template.isBuiltIn ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Built-in
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {template.organizationName ?? 'Org'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onView}
              title="View details"
            >
              <Eye className="h-3 w-3" />
            </Button>
            {canManage &&
              (confirmDelete ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 px-2 text-xs"
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-0.5">
                  {!template.isBuiltIn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onEdit}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </Button>
                  )}
                  {!template.isBuiltIn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {template.values.slice(0, 10).map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted"
              style={{ color: themeColor }}
            >
              {v.label}
            </span>
          ))}
          {template.values.length > 10 && (
            <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs text-muted-foreground">
              +{template.values.length - 10}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
