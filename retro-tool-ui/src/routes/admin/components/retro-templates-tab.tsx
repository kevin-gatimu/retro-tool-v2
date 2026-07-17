import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { Loader2, Plus, RefreshCw, Search, SquareStack } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeleteTemplateDialog } from '@/components/templates'
import { api } from '@/lib/api'
import { TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type {
  EditableColumn,
  PaginatedTemplatesResponse,
  TemplateWithColumns,
} from '../types'
import { useAdminAllOrganizations, useAdminTemplateMutations } from '../hooks'
import { createEmptyColumn } from '../helpers'
import { buildRetroTemplateColumns } from './retro-templates-columns'
import { RetroTemplateForm } from './retro-template-form'
import { RetroTemplateViewDialog } from './retro-template-view-dialog'
import { AdminTablePagination } from './admin-table-pagination'

const DEFAULT_PAGE_SIZE = 10

type TypeFilter = 'all' | 'built-in' | 'organization'

/** Admin retrospective templates tab: searchable/sortable table + CRUD dialogs. */
export function RetroTemplatesTab() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

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

  const { allOrgs } = useAdminAllOrganizations()

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

  const columns = useMemo(
    () =>
      buildRetroTemplateColumns({
        onView: setViewingTemplate,
        onEdit: openEdit,
        onDelete: setDeletingTemplate,
        updatePending: updateMutation.isPending,
        updateVariablesTemplateId: updateMutation.variables?.templateId,
        deletePending: deleteMutation.isPending,
        deleteVariables: deleteMutation.variables,
      }),
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

          <AdminTablePagination
            shownCount={templates.length}
            total={total}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            isFetching={isFetching}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
            }
          />
        </CardContent>
      </Card>

      <RetroTemplateViewDialog
        template={viewingTemplate}
        open={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
      />

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
          <RetroTemplateForm
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
          <RetroTemplateForm
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

      <DeleteTemplateDialog
        open={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={() => {
          if (deletingTemplate) {
            deleteMutation.mutate(deletingTemplate.id)
            setDeletingTemplate(null)
          }
        }}
        isPending={deleteMutation.isPending}
        title="Delete Template"
        description={
          <>
            This action cannot be undone. This will permanently delete
            <span className="font-semibold"> {deletingTemplate?.name}</span>.
          </>
        }
      />
    </div>
  )
}
