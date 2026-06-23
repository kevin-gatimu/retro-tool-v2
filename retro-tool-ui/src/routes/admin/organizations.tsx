import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { OrganizationsListSkeleton } from './skeleton'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import { useAdminOrganizationMutations } from './hooks/use-admin-organization-mutations'
import { toSlug } from './helpers'
import type { OrganizationAdminRow, PaginatedOrgsResponse } from './types'

const DEFAULT_PAGE_SIZE = 10

export const Route = createFileRoute('/admin/organizations')({
  pendingComponent: OrganizationsListSkeleton,
  component: AdminOrganizationsPage,
})

function AdminOrganizationsPage() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1) // 1-indexed
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

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
    data: orgsData,
    isFetching,
    isLoading,
  } = useQuery({
    queryKey: [
      'admin-organizations',
      page,
      pageSize,
      debouncedSearch,
      sortParam,
      sortOrderParam,
    ],
    queryFn: () => {
      let url = `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=${page}&limit=${pageSize}`
      if (debouncedSearch)
        url += `&search=${encodeURIComponent(debouncedSearch)}`
      if (sortParam) url += `&sort=${sortParam}`
      if (sortOrderParam) url += `&sortOrder=${sortOrderParam}`
      return api.get<PaginatedOrgsResponse>(url)
    },
    placeholderData: keepPreviousData,
  })
  const organizations = orgsData?.organizations ?? []
  const total = orgsData?.total ?? 0
  const totalPages = orgsData?.totalPages ?? 1

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isCreateSlugManuallyEdited, setIsCreateSlugManuallyEdited] =
    useState(false)

  const [editingOrg, setEditingOrg] = useState<OrganizationAdminRow | null>(
    null,
  )
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [isEditSlugManuallyEdited, setIsEditSlugManuallyEdited] =
    useState(false)

  const [deletingOrg, setDeletingOrg] = useState<OrganizationAdminRow | null>(
    null,
  )

  const { createMutation, updateMutation, deleteMutation } =
    useAdminOrganizationMutations({
      onCreateSuccess: () => {
        setIsCreateOpen(false)
        setName('')
        setSlug('')
        setIsCreateSlugManuallyEdited(false)
      },
      onUpdateSuccess: () => {
        setEditingOrg(null)
        setEditSlug('')
        setIsEditSlugManuallyEdited(false)
      },
      onDeleteSuccess: () => setDeletingOrg(null),
    })

  const handleNameChange = (value: string) => {
    setName(value)
    if (!isCreateSlugManuallyEdited) {
      setSlug(toSlug(value))
    }
  }

  const handleEditNameChange = (value: string) => {
    setEditName(value)
    if (!isEditSlugManuallyEdited) {
      setEditSlug(toSlug(value))
    }
  }

  const columns = useMemo<ColumnDef<OrganizationAdminRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            to="/organizations/$orgId"
            params={{ orgId: row.original.id }}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'slug',
        header: ({ column }) => (
          <SortableHeader column={column}>Slug</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">/{row.original.slug}</span>
        ),
      },
      {
        accessorKey: 'ownerId',
        header: ({ column }) => (
          <SortableHeader column={column}>Owner ID</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.ownerId}
          </span>
        ),
      },
      {
        id: 'memberCount',
        accessorFn: (row) => row.memberCount ?? 0,
        header: ({ column }) => (
          <SortableHeader column={column}>Members</SortableHeader>
        ),
        cell: ({ row }) => row.original.memberCount ?? '-',
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
          const rowId = row.original.id
          const isUpdatingRow =
            updateMutation.isPending && updateMutation.variables.id === rowId
          const isDeletingRow =
            deleteMutation.isPending && deleteMutation.variables === rowId
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
                  onClick={() => {
                    setEditingOrg(row.original)
                    setEditName(row.original.name)
                    setEditSlug(row.original.slug)
                    setIsEditSlugManuallyEdited(false)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={actionsDisabled}
                  onClick={() => setDeletingOrg(row.original)}
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
          <h2 className="text-2xl font-bold tracking-tight">Organizations</h2>
          <p className="text-muted-foreground">
            System-wide organization CRUD and visibility.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Organization
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
          <CardDescription>
            {total} organization{total === 1 ? '' : 's'} in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by org name"
                className="pl-9 h-8"
              />
            </div>
          </div>
          <DataTable
            columns={columns}
            data={organizations}
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
              Showing {organizations.length} of {total} organization
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
                    queryKey: ['admin-organizations'],
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

      {/* Create Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            setIsCreateSlugManuallyEdited(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization available across the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setIsCreateSlugManuallyEdited(true)
                  setSlug(toSlug(e.target.value))
                }}
                placeholder="acme-inc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ name, slug })}
              disabled={!name || !slug || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingOrg}
        onOpenChange={() => {
          setEditingOrg(null)
          setIsEditSlugManuallyEdited(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the organization name and slug.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="editName">Name</Label>
            <Input
              id="editName"
              value={editName}
              onChange={(e) => handleEditNameChange(e.target.value)}
            />
            <Label htmlFor="editSlug">Slug</Label>
            <Input
              id="editSlug"
              value={editSlug}
              onChange={(e) => {
                setIsEditSlugManuallyEdited(true)
                setEditSlug(toSlug(e.target.value))
              }}
              placeholder="acme-inc"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingOrg &&
                updateMutation.mutate({
                  id: editingOrg.id,
                  name: editName,
                  slug: editSlug,
                })
              }
              disabled={
                !editingOrg ||
                !editName ||
                !editSlug ||
                updateMutation.isPending
              }
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingOrg} onOpenChange={() => setDeletingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete
              <span className="font-semibold"> {deletingOrg?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrg(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingOrg && deleteMutation.mutate(deletingOrg.id)
              }
              disabled={!deletingOrg || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
