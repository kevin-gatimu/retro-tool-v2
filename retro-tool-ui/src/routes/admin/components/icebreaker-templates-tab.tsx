import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { Loader2, Plus, RefreshCw, Search, Sparkles } from 'lucide-react'
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
import { ICEBREAKER_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type {
  IcebreakerTemplate,
  PaginatedIcebreakerTemplatesResponse,
} from '@/common/types/icebreakers'
import {
  useAdminAllOrganizations,
  useAdminIcebreakerTemplateMutations,
} from '../hooks'
import { buildIcebreakerTemplateColumns } from './icebreaker-templates-columns'
import { IcebreakerTemplateViewDialog } from './icebreaker-template-view-dialog'
import { IcebreakerTemplateFormDialog } from './icebreaker-template-form-dialog'
import { AdminTablePagination } from './admin-table-pagination'

const DEFAULT_PAGE_SIZE = 10

type TypeFilter = 'all' | 'built-in' | 'organization'

/** Admin icebreaker templates tab: searchable/sortable table + CRUD dialogs. */
export function IcebreakerTemplatesTab() {
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
      'admin-icebreaker-templates',
      page,
      pageSize,
      debouncedSearch,
      typeFilter,
      sortParam,
      sortOrderParam,
    ],
    queryFn: () => {
      let url = `${ICEBREAKER_TEMPLATES_ENDPOINTS.LIST}?page=${page}&limit=${pageSize}`
      if (debouncedSearch)
        url += `&search=${encodeURIComponent(debouncedSearch)}`
      if (typeFilter !== 'all') url += `&type=${typeFilter}`
      if (sortParam) url += `&sort=${sortParam}`
      if (sortOrderParam) url += `&sortOrder=${sortOrderParam}`
      return api.get<PaginatedIcebreakerTemplatesResponse>(url)
    },
    placeholderData: keepPreviousData,
  })

  const { allOrgs } = useAdminAllOrganizations()

  const templates = templatesData?.templates ?? []
  const total = templatesData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] =
    useState<IcebreakerTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] =
    useState<IcebreakerTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] =
    useState<IcebreakerTemplate | null>(null)

  const { seedMutation, createMutation, updateMutation, deleteMutation } =
    useAdminIcebreakerTemplateMutations({
      onCreateSuccess: () => setIsCreateOpen(false),
      onUpdateSuccess: () => setEditingTemplate(null),
      onDeleteSuccess: () => setDeletingTemplate(null),
    })

  const columns = useMemo(
    () =>
      buildIcebreakerTemplateColumns({
        onView: setViewingTemplate,
        onEdit: setEditingTemplate,
        onDelete: setDeletingTemplate,
        actionsDisabled: updateMutation.isPending || deleteMutation.isPending,
      }),
    [updateMutation.isPending, deleteMutation.isPending],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Icebreaker Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage built-in and organization icebreaker templates.
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
            <Sparkles className="h-5 w-5" />
            All Icebreaker Templates
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
              queryClient.invalidateQueries({
                queryKey: ['admin-icebreaker-templates'],
              })
            }
          />
        </CardContent>
      </Card>

      <IcebreakerTemplateViewDialog
        template={viewingTemplate}
        open={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
      />

      {isCreateOpen && (
        <IcebreakerTemplateFormDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          allOrgs={allOrgs}
          onSubmit={(body) => createMutation.mutate(body)}
          isPending={createMutation.isPending}
        />
      )}

      {editingTemplate && (
        <IcebreakerTemplateFormDialog
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

      <DeleteTemplateDialog
        open={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={() => {
          if (deletingTemplate) {
            deleteMutation.mutate(deletingTemplate.id)
          }
        }}
        isPending={deleteMutation.isPending}
        title="Delete Icebreaker Template"
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
