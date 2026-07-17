import { useState } from 'react'
import { Edit, Layers, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'
import { ESTIMATE_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
} from '@/common/types/estimates'
import { OrgEstimateTemplateDialog } from './org-estimate-template-dialog'

export function OrgEstimateTemplatesSection({
  orgId,
  canManage,
}: {
  orgId: string
  canManage: boolean
}) {
  const queryClient = useQueryClient()

  const queryKey = ['org-estimate-templates', orgId] as const

  const templatesQuery = useQuery({
    queryKey,
    queryFn: () =>
      api
        .get<PaginatedEstimateTemplatesResponse>(
          `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?type=organization&page=1&limit=100`,
        )
        .then((r) => r.templates.filter((t) => t.organizationId === orgId)),
    staleTime: 60_000,
  })
  const templates = templatesQuery.data ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EstimateTemplate | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<EstimateTemplate | null>(
    null,
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Story Estimate Templates</h2>
          <p className="text-sm text-muted-foreground">
            Custom voting scales for estimation sessions in this organisation.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No estimate templates yet</p>
            <p className="text-sm text-muted-foreground">
              Create a custom voting scale for your team.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const themeColor = t.color ?? '#6366f1'
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm truncate">{t.name}</CardTitle>
                  {t.description && (
                    <CardDescription className="text-xs mt-0.5 line-clamp-2">
                      {t.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.values.slice(0, 10).map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted"
                        style={{ color: themeColor }}
                      >
                        {v.label}
                      </span>
                    ))}
                    {t.values.length > 10 && (
                      <span className="text-xs text-muted-foreground">
                        +{t.values.length - 10}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTemplate(t)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <OrgEstimateTemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        onSuccess={() => {
          setCreateOpen(false)
          invalidate()
        }}
      />

      {editTemplate && (
        <OrgEstimateTemplateDialog
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          orgId={orgId}
          template={editTemplate}
          onSuccess={() => {
            setEditTemplate(null)
            invalidate()
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimate template?</AlertDialogTitle>
            <AlertDialogDescription>
              Sessions using this template will lose the template association,
              but all vote and round data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
