import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  FileText,
  Leaf,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Save,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { AdminUsersSkeleton } from '@/components/skeletons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Organization } from '@/common/types/organizations'
import type { CreateTemplateInput } from '@/common/types/templates'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
} from '@/lib/api-endpoints'
import { useAdminTemplateMutations } from './hooks/useAdminTemplateMutations'
import { AdminNav, createEmptyColumn } from './helpers'
import type {
  EditableColumn,
  PaginatedTemplatesResponse,
  TemplateWithColumns,
} from './types'

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]
const DEFAULT_PAGE_SIZE = 6

export const Route = createFileRoute('/admin/templates')({
  pendingComponent: AdminUsersSkeleton,
  component: AdminTemplatesPage,
})

function AdminTemplatesPage() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  )
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [columns, setColumns] = useState<EditableColumn[]>([
    createEmptyColumn(0),
    createEmptyColumn(1),
    createEmptyColumn(2),
  ])
  const [formError, setFormError] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] =
    useState<TemplateWithColumns | null>(null)

  const orgsQuery = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () =>
      api
        .get<{
          organizations: Organization[]
        }>(ORGANIZATIONS_ENDPOINTS.LIST_ALL)
        .then((r) => r.organizations),
    initialData: [],
  })
  const orgs = orgsQuery.data

  const templatesQuery = useQuery({
    queryKey: ['admin-templates', page, pageSize, search],
    queryFn: () =>
      api.get<PaginatedTemplatesResponse>(
        `${TEMPLATES_ENDPOINTS.LIST}?page=${page}&limit=${pageSize}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-templates'] })

  const { seedMutation, createMutation, updateMutation, deleteMutation } =
    useAdminTemplateMutations({
      onCreateSuccess: () => {
        setDialogOpen(false)
        resetForm()
      },
      onUpdateSuccess: () => {
        setDialogOpen(false)
        resetForm()
      },
      onCreateError: (message) => setFormError(message),
      onUpdateError: (message) => setFormError(message),
    })

  const templates = templatesQuery.data?.templates ?? []
  const total = templatesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const dialogTitle = editingTemplateId ? 'Edit Template' : 'Create Template'
  const isSaving = createMutation.isPending || updateMutation.isPending

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  )

  const resetForm = () => {
    setEditingTemplateId(null)
    setName('')
    setDescription('')
    setOrganizationId('')
    setColumns([
      createEmptyColumn(0),
      createEmptyColumn(1),
      createEmptyColumn(2),
    ])
    setFormError(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (template: TemplateWithColumns) => {
    setEditingTemplateId(template.id)
    setName(template.name)
    setDescription(template.description ?? '')
    setOrganizationId(template.organizationId ?? '')
    setColumns(
      template.columns.length > 0
        ? template.columns
            .sort((a, b) => a.order - b.order)
            .map((column) => ({
              name: column.name,
              emoji: column.emoji ?? '',
              prompt: column.prompt ?? '',
              order: column.order,
            }))
        : [createEmptyColumn(0)],
    )
    setFormError(null)
    setDialogOpen(true)
  }

  const updateColumn = (
    index: number,
    key: keyof EditableColumn,
    value: string | number,
  ) => {
    setColumns((current) => {
      const next = [...current]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  const addColumn = () => {
    setColumns((current) => [...current, createEmptyColumn(current.length)])
  }

  const removeColumn = (index: number) => {
    setColumns((current) => current.filter((_, i) => i !== index))
  }

  const handleSeed = () => {
    seedMutation.mutate()
  }

  const submit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Template name is required')
      return
    }

    const cleanedColumns = sortedColumns
      .map((column, index) => ({
        name: column.name.trim(),
        emoji: column.emoji.trim() || undefined,
        prompt: column.prompt.trim() || undefined,
        order: index,
      }))
      .filter((column) => column.name.length > 0)

    if (cleanedColumns.length === 0) {
      setFormError('At least one column is required')
      return
    }

    const payload: CreateTemplateInput = {
      name: trimmedName,
      description: description.trim() || undefined,
      organizationId: organizationId.trim() || undefined,
      columns: cleanedColumns,
    }

    if (editingTemplateId) {
      updateMutation.mutate({ templateId: editingTemplateId, payload })
      return
    }

    createMutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Retro Templates</h2>
          <p className="text-muted-foreground">
            Create, edit, seed, delete, and review all retrospective templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={seedMutation.isPending}
            onClick={handleSeed}
          >
            {seedMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Leaf className="mr-2 h-4 w-4" />
            )}
            {seedMutation.isPending ? 'Seeding...' : 'Seed Built-In'}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search templates"
            className="pl-9"
          />
        </div>
      </div>

      {total === 0 && !templatesQuery.isFetching ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">No templates found</CardTitle>
            <CardDescription className="text-center">
              Create your first template or seed built-in templates.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="line-clamp-1">
                      {template.name}
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-1">
                      {template.isBuiltIn && (
                        <Badge variant="secondary">Built-in</Badge>
                      )}
                      {template.organizationName && (
                        <Badge variant="outline" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {template.organizationName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {template.columns
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((column) => (
                        <div
                          key={column.id}
                          className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                        >
                          <span>{column.emoji ?? '•'}</span>
                          <span>{column.name}</span>
                        </div>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => setTemplateToDelete(template)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val))
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>
                Page {page} of {totalPages} &middot; {total} templates
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={invalidateAll}
                disabled={templatesQuery.isFetching}
                title="Refresh"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${templatesQuery.isFetching ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={templateToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete template &quot;{templateToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (templateToDelete) {
                  deleteMutation.mutate(templateToDelete.id)
                  setTemplateToDelete(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Configure template details and columns for your retrospective
              workflow.
            </DialogDescription>
          </DialogHeader>

          <form
            id="template-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!isSaving) submit()
            }}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Start / Stop / Continue"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short description of when to use this template"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Organization (optional)</Label>
                <Select
                  value={organizationId || '__global__'}
                  onValueChange={(val) =>
                    setOrganizationId(val === '__global__' ? '' : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Global (no org)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (no org)</SelectItem>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Column
                  </Button>
                </div>

                {sortedColumns.map((column, index) => (
                  <Card key={`column-${index}`}>
                    <CardContent className="grid gap-3 p-4">
                      <div className="grid gap-3 md:grid-cols-[90px_1fr]">
                        <div className="space-y-1">
                          <Label>Emoji</Label>
                          <Input
                            value={column.emoji}
                            onChange={(event) =>
                              updateColumn(index, 'emoji', event.target.value)
                            }
                            placeholder="😀"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input
                            value={column.name}
                            onChange={(event) =>
                              updateColumn(index, 'name', event.target.value)
                            }
                            placeholder="What went well"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Prompt (optional)</Label>
                        <Textarea
                          value={column.prompt}
                          onChange={(event) =>
                            updateColumn(index, 'prompt', event.target.value)
                          }
                          rows={2}
                          placeholder="Guide for what cards to add in this column"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={sortedColumns.length <= 1}
                          onClick={() => removeColumn(index)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button form="template-form" type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving
                ? 'Saving...'
                : editingTemplateId
                  ? 'Save Changes'
                  : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
