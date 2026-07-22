import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { TemplateWithColumns } from '../types'

/**
 * Retro template card for the `/templates` page. Shows the template name,
 * description, and its columns. Owners see an inline confirm-delete control.
 * Presentational: the parent owns the delete mutation.
 */
export function TemplateCard({
  template,
  orgName,
  canManage,
  onDelete,
  deleting,
}: {
  template: TemplateWithColumns
  orgName?: string
  canManage: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {template.name}
            </CardTitle>
            <CardDescription className="mt-0.5 line-clamp-2">
              {template.description ?? 'No description'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {template.isBuiltIn ? (
              <Badge variant="secondary" className="text-xs">
                Built-in
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs border-primary/40 text-primary"
              >
                {orgName ?? 'Org'}
              </Badge>
            )}
            {canManage &&
              !template.isBuiltIn &&
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {template.columns
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((col) => (
              <div
                key={col.id}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {col.emoji && <span>{col.emoji}</span>}
                <span>{col.name}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
