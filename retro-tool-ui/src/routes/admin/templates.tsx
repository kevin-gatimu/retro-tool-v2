import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SquareStack,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminTemplatesSkeleton } from './skeleton'
import {
  TShirtIcon,
  getShirtScale,
  isTShirtTemplateName,
} from '@/components/TShirtIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import {
  ESTIMATE_TEMPLATES_ENDPOINTS,
  ORGANIZATIONS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
} from '@/lib/api-endpoints'
import { useAdminTemplateMutations } from './hooks/useAdminTemplateMutations'
import { createEmptyColumn } from './helpers'
import type {
  EditableColumn,
  OrganizationAdminRow,
  PaginatedOrgsResponse,
  PaginatedTemplatesResponse,
  TemplateWithColumns,
} from './types'
import type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
  CreateEstimateTemplateInput,
} from '@/common/types/estimates'

const DEFAULT_PAGE_SIZE = 10

type TypeFilter = 'all' | 'built-in' | 'organization'

export const Route = createFileRoute('/admin/templates')({
  pendingComponent: AdminTemplatesSkeleton,
  component: AdminTemplatesPage,
})

function AdminTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
        <p className="text-muted-foreground">
          Manage retrospective and story estimate templates.
        </p>
      </div>

      <Tabs defaultValue="retro">
        <TabsList>
          <TabsTrigger value="retro">
            <FileText className="h-4 w-4 mr-2" />
            Retrospective Templates
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Layers className="h-4 w-4 mr-2" />
            Story Estimate Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retro" className="mt-6">
          <RetroTemplatesContent />
        </TabsContent>

        <TabsContent value="estimate" className="mt-6">
          <AdminEstimateTemplatesContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Retro Templates Content (existing functionality)
// ============================================================================

function RetroTemplatesContent() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const sortParam = sorting[0]?.id
  const sortOrderParam = sorting[0]
    ? sorting[0].desc
      ? 'desc'
      : 'asc'
    : undefined

  const {
    data: templatesData,
    isFetching,
    isLoading,
  } = useQuery({
    queryKey: [
      'admin-templates',
      page,
      pageSize,
      debouncedSearch,
      typeFilter,
      sortParam,
      sortOrderParam,
    ],
    queryFn: () => {
      let url = `${TEMPLATES_ENDPOINTS.LIST}?page=${page}&limit=${pageSize}`
      if (debouncedSearch)
        url += `&search=${encodeURIComponent(debouncedSearch)}`
      if (typeFilter !== 'all') url += `&type=${typeFilter}`
      if (sortParam) url += `&sort=${sortParam}`
      if (sortOrderParam) url += `&sortOrder=${sortOrderParam}`
      return api.get<PaginatedTemplatesResponse>(url)
    },
    placeholderData: keepPreviousData,
  })

  const { data: orgsData } = useQuery({
    queryKey: ['admin-all-organizations'],
    queryFn: () =>
      api.get<PaginatedOrgsResponse>(
        `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=1&limit=1000`,
      ),
    staleTime: 60_000,
  })
  const allOrgs = orgsData?.organizations ?? []

  const templates = templatesData?.templates ?? []
  const total = templatesData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<TemplateWithColumns | null>(null)
  const [deletingTemplate, setDeletingTemplate] =
    useState<TemplateWithColumns | null>(null)
  const [viewingTemplate, setViewingTemplate] =
    useState<TemplateWithColumns | null>(null)

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formOrgId, setFormOrgId] = useState('')
  const [formColumns, setFormColumns] = useState<EditableColumn[]>([
    createEmptyColumn(0),
  ])

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormOrgId('')
    setFormColumns([createEmptyColumn(0)])
  }

  const openEdit = (t: TemplateWithColumns) => {
    setFormName(t.name)
    setFormDesc(t.description ?? '')
    setFormOrgId(t.organizationId ?? '')
    setFormColumns(
      t.columns.length > 0
        ? t.columns.map((c, i) => ({
            name: c.name,
            emoji: c.emoji ?? '',
            prompt: c.prompt ?? '',
            order: i,
          }))
        : [createEmptyColumn(0)],
    )
    setEditingTemplate(t)
  }

  const { seedMutation, createMutation, updateMutation, deleteMutation } =
    useAdminTemplateMutations({
      onCreateSuccess: () => {
        setIsCreateOpen(false)
        resetForm()
      },
      onUpdateSuccess: () => {
        setEditingTemplate(null)
        resetForm()
      },
    })

  const validColumns = (cols: EditableColumn[]) =>
    cols
      .filter((c) => c.name.trim())
      .map((c, i) => ({
        name: c.name.trim(),
        emoji: c.emoji || undefined,
        prompt: c.prompt || undefined,
        order: i,
      }))

  const columns = useMemo<ColumnDef<TemplateWithColumns>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: 'type',
        header: () => <span>Type</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isBuiltIn ? (
            <Badge variant="secondary">Built-in</Badge>
          ) : (
            <Badge variant="outline">
              {row.original.organizationName ?? 'Organization'}
            </Badge>
          ),
      },
      {
        id: 'description',
        header: () => <span>Description</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1 max-w-xs">
            {row.original.description ?? '—'}
          </span>
        ),
      },
      {
        id: 'columns',
        header: () => <span>Columns</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.columns.length}</Badge>
        ),
      },
      {
        id: 'createdAt',
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: ({ column }) => (
          <SortableHeader column={column}>Created</SortableHeader>
        ),
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: () => <span>Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original
          const isUpdatingRow =
            updateMutation.isPending &&
            updateMutation.variables.templateId === t.id
          const isDeletingRow =
            deleteMutation.isPending && deleteMutation.variables === t.id
          const rowActionLoading = isUpdatingRow || isDeletingRow
          const actionsDisabled =
            updateMutation.isPending || deleteMutation.isPending

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={actionsDisabled}
                >
                  {rowActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewingTemplate(t)}>
                  <SquareStack className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  onClick={() => openEdit(t)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={actionsDisabled}
                  onClick={() => setDeletingTemplate(t)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [
      deleteMutation.isPending,
      deleteMutation.variables,
      updateMutation.isPending,
      updateMutation.variables,
    ],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Retrospective Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage built-in and organization retrospective templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Seed Built-in
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SquareStack className="h-5 w-5" />
            All Templates
          </CardTitle>
          <CardDescription>
            {total} template{total === 1 ? '' : 's'} in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-9 h-8 w-64"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as TypeFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="built-in">Built-in</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={templates}
            pagination={false}
            manualSorting
            sorting={sorting}
            onSortingChange={(nextSorting) => {
              setSorting(nextSorting)
              setPage(1)
            }}
            loading={isLoading}
            isFetching={isFetching}
          />

          <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {templates.length} of {total} template
              {total === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages || isFetching}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['admin-templates'],
                  })
                }
                disabled={isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog
        open={!!viewingTemplate}
        onOpenChange={(o) => {
          if (!o) setViewingTemplate(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingTemplate?.name}
              {viewingTemplate?.isBuiltIn ? (
                <Badge variant="secondary" className="text-xs">
                  Built-in
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {viewingTemplate?.organizationName ?? 'Org'}
                </Badge>
              )}
            </DialogTitle>
            {viewingTemplate?.description && (
              <DialogDescription>
                {viewingTemplate.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">
                COLUMNS ({viewingTemplate?.columns.length ?? 0})
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {viewingTemplate?.columns
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((col) => (
                    <div
                      key={col.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      {col.emoji && (
                        <span className="text-2xl">{col.emoji}</span>
                      )}
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
              {viewingTemplate?.createdAt
                ? new Date(viewingTemplate.createdAt).toLocaleDateString(
                    undefined,
                    { year: 'numeric', month: 'long', day: 'numeric' },
                  )
                : '—'}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setViewingTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Add a new retrospective template to the system.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            formName={formName}
            formDesc={formDesc}
            formOrgId={formOrgId}
            formColumns={formColumns}
            allOrgs={allOrgs}
            onNameChange={setFormName}
            onDescChange={setFormDesc}
            onOrgIdChange={setFormOrgId}
            onColumnsChange={setFormColumns}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: formName,
                  description: formDesc || undefined,
                  organizationId: formOrgId || undefined,
                  columns: validColumns(formColumns),
                })
              }
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplate(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template details and columns.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            formName={formName}
            formDesc={formDesc}
            formOrgId={formOrgId}
            formColumns={formColumns}
            allOrgs={allOrgs}
            onNameChange={setFormName}
            onDescChange={setFormDesc}
            onOrgIdChange={setFormOrgId}
            onColumnsChange={setFormColumns}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTemplate(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingTemplate &&
                updateMutation.mutate({
                  templateId: editingTemplate.id,
                  payload: {
                    name: formName,
                    description: formDesc || undefined,
                    organizationId: formOrgId || undefined,
                    columns: validColumns(formColumns),
                  },
                })
              }
              disabled={!formName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!deletingTemplate}
        onOpenChange={(open) => {
          if (!open) setDeletingTemplate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete
              <span className="font-semibold"> {deletingTemplate?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingTemplate) {
                  deleteMutation.mutate(deletingTemplate.id)
                  setDeletingTemplate(null)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Admin Estimate Templates Content
// ============================================================================

type EstValueDraft = {
  label: string
  value: string
  color: string
  description: string
}

function AdminEstimateTemplatesContent() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const sortParam = sorting[0]?.id
  const sortOrderParam = sorting[0]
    ? sorting[0].desc
      ? 'desc'
      : 'asc'
    : undefined

  const queryKey = [
    'admin-estimate-templates',
    page,
    pageSize,
    debouncedSearch,
    typeFilter,
    sortParam,
    sortOrderParam,
  ]

  const {
    data: templatesData,
    isFetching,
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: () => {
      let url = `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?page=${page}&limit=${pageSize}`
      if (debouncedSearch)
        url += `&search=${encodeURIComponent(debouncedSearch)}`
      if (typeFilter !== 'all') url += `&type=${typeFilter}`
      if (sortParam) url += `&sort=${sortParam}`
      if (sortOrderParam) url += `&sortOrder=${sortOrderParam}`
      return api.get<PaginatedEstimateTemplatesResponse>(url)
    },
    placeholderData: keepPreviousData,
  })

  const { data: orgsData } = useQuery({
    queryKey: ['admin-all-organizations'],
    queryFn: () =>
      api.get<PaginatedOrgsResponse>(
        `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=1&limit=1000`,
      ),
    staleTime: 60_000,
  })
  const allOrgs = orgsData?.organizations ?? []

  const templates = templatesData?.templates ?? []
  const total = templatesData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-estimate-templates'] })

  const seedMutation = useMutation({
    mutationFn: () => api.post(ESTIMATE_TEMPLATES_ENDPOINTS.SEED),
    onSuccess: () => {
      toast.success('Built-in estimate templates seeded')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to seed templates'),
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateEstimateTemplateInput) =>
      api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, body),
    onSuccess: () => {
      toast.success('Template created')
      setIsCreateOpen(false)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create template'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Partial<CreateEstimateTemplateInput>
    }) => api.patch(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id), body),
    onSuccess: () => {
      toast.success('Template updated')
      setEditingTemplate(null)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to update template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      setDeletingTemplate(null)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<EstimateTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] =
    useState<EstimateTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] =
    useState<EstimateTemplate | null>(null)

  const columns = useMemo<ColumnDef<EstimateTemplate>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: 'type',
        header: () => <span>Type</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isBuiltIn ? (
            <Badge variant="secondary">Built-in</Badge>
          ) : (
            <Badge variant="outline">
              {row.original.organizationName ?? 'Organization'}
            </Badge>
          ),
      },
      {
        id: 'description',
        header: () => <span>Description</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1 max-w-xs">
            {row.original.description ?? '—'}
          </span>
        ),
      },
      {
        id: 'values',
        header: () => <span>Values</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.values.length}</Badge>
        ),
      },
      {
        id: 'createdAt',
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: ({ column }) => (
          <SortableHeader column={column}>Created</SortableHeader>
        ),
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: () => <span>Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original
          const actionsDisabled =
            updateMutation.isPending || deleteMutation.isPending

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={actionsDisabled}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewingTemplate(t)}>
                  <SquareStack className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  onClick={() => setEditingTemplate(t)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={actionsDisabled}
                  onClick={() => setDeletingTemplate(t)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [updateMutation.isPending, deleteMutation.isPending],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Story Estimate Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage built-in and organization estimate templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Seed Built-in
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            All Estimate Templates
          </CardTitle>
          <CardDescription>
            {total} template{total === 1 ? '' : 's'} in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-9 h-8 w-64"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as TypeFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="built-in">Built-in</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={templates}
            pagination={false}
            manualSorting
            sorting={sorting}
            onSortingChange={(nextSorting) => {
              setSorting(nextSorting)
              setPage(1)
            }}
            loading={isLoading}
          />

          <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {templates.length} of {total} template
              {total === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages || isFetching}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['admin-estimate-templates'],
                  })
                }
                disabled={isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog
        open={!!viewingTemplate}
        onOpenChange={(o) => {
          if (!o) setViewingTemplate(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingTemplate?.name}
              {viewingTemplate?.isBuiltIn ? (
                <Badge variant="secondary" className="text-xs">
                  Built-in
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {viewingTemplate?.organizationName ?? 'Org'}
                </Badge>
              )}
            </DialogTitle>
            {viewingTemplate?.description && (
              <DialogDescription>
                {viewingTemplate.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            {viewingTemplate?.color && (
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: viewingTemplate.color }}
                />
                <span className="text-xs font-mono text-muted-foreground">
                  {viewingTemplate.color}
                </span>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">
                VALUES ({viewingTemplate?.values.length ?? 0})
              </Label>
              {viewingTemplate && isTShirtTemplateName(viewingTemplate.name) ? (
                <div className="flex flex-wrap gap-3">
                  {viewingTemplate.values
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
                            themeColor={viewingTemplate.color ?? '#f43f5e'}
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
                  {viewingTemplate?.values
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
                                color:
                                  v.color ?? viewingTemplate.color ?? '#6366f1',
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
              {viewingTemplate?.createdAt
                ? new Date(viewingTemplate.createdAt).toLocaleDateString(
                    undefined,
                    { year: 'numeric', month: 'long', day: 'numeric' },
                  )
                : '—'}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setViewingTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      {isCreateOpen && (
        <EstimateTemplateFormDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          allOrgs={allOrgs}
          onSubmit={(body) => createMutation.mutate(body)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Edit Dialog */}
      {editingTemplate && (
        <EstimateTemplateFormDialog
          open={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          allOrgs={allOrgs}
          template={editingTemplate}
          onSubmit={(body) =>
            updateMutation.mutate({ id: editingTemplate.id, body })
          }
          isPending={updateMutation.isPending}
        />
      )}

      {/* Delete Dialog */}
      <Dialog
        open={!!deletingTemplate}
        onOpenChange={(open) => {
          if (!open) setDeletingTemplate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Estimate Template</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Sessions using this template will
              lose the template association, but all vote data will be
              preserved.
              <span className="font-semibold block mt-1">
                {deletingTemplate?.name}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingTemplate) {
                  deleteMutation.mutate(deletingTemplate.id)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Estimate Template Form Dialog
// ============================================================================

function EstimateTemplateFormDialog({
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
  template?: EstimateTemplate
  onSubmit: (body: CreateEstimateTemplateInput) => void
  isPending: boolean
}) {
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [desc, setDesc] = useState(template?.description ?? '')
  const [orgId, setOrgId] = useState(template?.organizationId ?? '')
  const [color, setColor] = useState(template?.color ?? '#6366f1')
  const [values, setValues] = useState<EstValueDraft[]>(
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
  const canSubmit = name.trim().length > 0 && validValues.length > 0

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: desc.trim() || undefined,
      organizationId: orgId || undefined,
      color: color || undefined,
      values: validValues.map((v, i) => ({
        label: v.label.trim(),
        value: v.value.trim(),
        order: i,
        color: v.color || undefined,
        description: v.description.trim() || undefined,
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

// ============================================================================
// Retro Template Form (existing)
// ============================================================================

type TemplateFormProps = {
  formName: string
  formDesc: string
  formOrgId: string
  formColumns: EditableColumn[]
  allOrgs: OrganizationAdminRow[]
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
  onOrgIdChange: (v: string) => void
  onColumnsChange: (cols: EditableColumn[]) => void
}

function TemplateForm({
  formName,
  formDesc,
  formOrgId,
  formColumns,
  allOrgs,
  onNameChange,
  onDescChange,
  onOrgIdChange,
  onColumnsChange,
}: TemplateFormProps) {
  const updateColumn = (
    index: number,
    field: keyof EditableColumn,
    value: string,
  ) => {
    onColumnsChange(
      formColumns.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }

  const addColumn = () => {
    onColumnsChange([...formColumns, createEmptyColumn(formColumns.length)])
  }

  const removeColumn = (index: number) => {
    onColumnsChange(
      formColumns
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, order: i })),
    )
  }

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="templateName">Name *</Label>
        <Input
          id="templateName"
          value={formName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Sprint Retrospective"
          maxCharacters={40}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="templateDesc">Description</Label>
        <Textarea
          id="templateDesc"
          value={formDesc}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="Brief description of this template"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="templateOrg">Organization</Label>
        <Select
          value={formOrgId || 'none'}
          onValueChange={(v) => onOrgIdChange(v === 'none' ? '' : v)}
        >
          <SelectTrigger id="templateOrg">
            <SelectValue placeholder="None (global)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (global)</SelectItem>
            {allOrgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Columns</Label>
        <div className="space-y-2">
          {formColumns.map((col, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={col.emoji}
                onChange={(e) => updateColumn(i, 'emoji', e.target.value)}
                placeholder="😀"
                className="w-16 text-center shrink-0"
              />
              <Input
                value={col.name}
                onChange={(e) => updateColumn(i, 'name', e.target.value)}
                placeholder="Column name"
                maxCharacters={40}
              />
              <Input
                value={col.prompt}
                onChange={(e) => updateColumn(i, 'prompt', e.target.value)}
                placeholder="Prompt (optional)"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeColumn(i)}
                disabled={formColumns.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addColumn}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Column
          </Button>
        </div>
      </div>
    </div>
  )
}
