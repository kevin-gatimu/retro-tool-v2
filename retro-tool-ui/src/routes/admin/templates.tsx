import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
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
import { AdminTemplatesSkeleton } from '@/components/skeletons'
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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
} from '@/lib/api-endpoints'
import { useAdminTemplateMutations } from './hooks/useAdminTemplateMutations'
import { AdminNav, createEmptyColumn } from './helpers'
import type {
  EditableColumn,
  OrganizationAdminRow,
  PaginatedOrgsResponse,
  PaginatedTemplatesResponse,
  TemplateWithColumns,
} from './types'

const DEFAULT_PAGE_SIZE = 10

type TypeFilter = 'all' | 'built-in' | 'organization'

export const Route = createFileRoute('/admin/templates')({
  pendingComponent: AdminTemplatesSkeleton,
  component: AdminTemplatesPage,
})

function AdminTemplatesPage() {
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

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<TemplateWithColumns | null>(null)
  const [deletingTemplate, setDeletingTemplate] =
    useState<TemplateWithColumns | null>(null)

  // ── Shared form state ─────────────────────────────────────────────────────
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

  // ── Table columns ─────────────────────────────────────────────────────────
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
      <AdminNav />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
          <p className="text-muted-foreground">
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

      {/* ── Create Dialog ───────────────────────────────────────────────── */}
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

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
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

      {/* ── Delete Dialog ───────────────────────────────────────────────── */}
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

// ── Template Form ─────────────────────────────────────────────────────────────

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
