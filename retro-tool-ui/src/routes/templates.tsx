import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import { TemplatesListSkeleton } from '@/components/skeletons'
import type { Template } from '@/common/types/templates'
import type { Organization } from '@/common/types/organizations'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  RETROS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
} from '@/lib/api-endpoints'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type TemplateWithColumns = Template & {
  columns: Array<{
    id: string
    name: string
    emoji: string | null
    prompt: string | null
    order: number
  }>
  organizationName?: string | null
}

type PaginatedTemplatesResponse = {
  templates: TemplateWithColumns[]
  total: number
  page: number
  limit: number
}

type ColumnDraft = { name: string; emoji: string; prompt: string }

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]
const DEFAULT_PAGE_SIZE = 6

function buildTemplatesQueryKey(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
  search: string,
) {
  return ['templates', type, page, limit, search] as const
}

function fetchTemplates(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
  search: string,
) {
  const params = new URLSearchParams({
    type,
    page: String(page),
    limit: String(limit),
  })
  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }

  return api.get<PaginatedTemplatesResponse>(
    `${TEMPLATES_ENDPOINTS.LIST}?${params.toString()}`,
  )
}

export const Route = createFileRoute('/templates')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        queryKey: buildTemplatesQueryKey('built-in', 1, DEFAULT_PAGE_SIZE, ''),
        queryFn: () => fetchTemplates('built-in', 1, DEFAULT_PAGE_SIZE, ''),
      }),
      queryClient.ensureQueryData({
        queryKey: buildTemplatesQueryKey(
          'organization',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () => fetchTemplates('organization', 1, DEFAULT_PAGE_SIZE, ''),
      }),
    ]),
  pendingComponent: TemplatesListSkeleton,
  component: TemplatesPage,
})

function TemplatesPage() {
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const sysAdmin = user?.role ? isSystemAdmin(user.role) : false

  // Separate pagination state per section
  const [orgPageSize, setOrgPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orgPage, setOrgPage] = useState(1)
  const [builtInPageSize, setBuiltInPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [builtInPage, setBuiltInPage] = useState(1)
  const [search, setSearch] = useState('')

  // Server-side paginated queries
  const builtInQuery = useQuery({
    queryKey: buildTemplatesQueryKey(
      'built-in',
      builtInPage,
      builtInPageSize,
      search,
    ),
    queryFn: () =>
      fetchTemplates('built-in', builtInPage, builtInPageSize, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const orgQuery = useQuery({
    queryKey: buildTemplatesQueryKey(
      'organization',
      orgPage,
      orgPageSize,
      search,
    ),
    queryFn: () => fetchTemplates('organization', orgPage, orgPageSize, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const builtInTemplates = builtInQuery.data?.templates ?? []
  const builtInTotal = builtInQuery.data?.total ?? 0
  const builtInTotalPages = Math.max(
    1,
    Math.ceil(builtInTotal / builtInPageSize),
  )

  const orgTemplates = orgQuery.data?.templates ?? []
  const orgTotal = orgQuery.data?.total ?? 0
  const orgTotalPages = Math.max(1, Math.ceil(orgTotal / orgPageSize))

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () =>
      api.get<{ organizations: Organization[] }>(ORGANIZATIONS_ENDPOINTS.LIST),
  })
  const orgs = orgsData?.organizations ?? []
  const adminOrgs = orgs.filter(
    (o) => o.myRole === 'org-owner' || o.myRole === 'org-admin',
  )
  const canCreateOrgTemplate = adminOrgs.length > 0 || sysAdmin

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['templates'] })

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createOrgId, setCreateOrgId] = useState<string>('')
  const [createColumns, setCreateColumns] = useState<ColumnDraft[]>([
    { name: '', emoji: '', prompt: '' },
  ])

  const resetCreate = () => {
    setCreateName('')
    setCreateDesc('')
    setCreateOrgId('')
    setCreateColumns([{ name: '', emoji: '', prompt: '' }])
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(RETROS_ENDPOINTS.TEMPLATES, {
        name: createName,
        description: createDesc || undefined,
        organizationId: createOrgId || undefined,
        columns: createColumns
          .filter((c) => c.name.trim())
          .map((c, i) => ({
            name: c.name.trim(),
            emoji: c.emoji || undefined,
            prompt: c.prompt || undefined,
            order: i,
          })),
      }),
    onSuccess: () => {
      toast.success('Template created')
      setCreateOpen(false)
      resetCreate()
      invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(RETROS_ENDPOINTS.TEMPLATE_BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  const canManageTemplate = (t: TemplateWithColumns) => {
    if (sysAdmin) return true
    if (!t.organizationId) return false
    return adminOrgs.some((o) => o.id === t.organizationId)
  }

  const orgNameFor = (t: TemplateWithColumns) =>
    t.organizationName ??
    orgs.find((o) => o.id === t.organizationId)?.name ??
    'Organization'

  const isEmpty =
    builtInTotal === 0 &&
    orgTotal === 0 &&
    !builtInQuery.isFetching &&
    !orgQuery.isFetching

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Browse and manage retrospective templates
          </p>
        </div>
        {canCreateOrgTemplate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOrgPage(1)
              setBuiltInPage(1)
            }}
            placeholder="Search templates"
            className="pl-9"
          />
        </div>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">No templates available</CardTitle>
            <CardDescription className="text-center">
              Templates will appear here once they are created.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Organization Templates */}
          {orgTotal > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  Organization Templates
                </h2>
                <Badge variant="outline">{orgTotal}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {orgTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    orgName={orgNameFor(t)}
                    canManage={canManageTemplate(t)}
                    onDelete={() => deleteMutation.mutate(t.id)}
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </div>
              <PaginationBar
                page={orgPage}
                totalPages={orgTotalPages}
                total={orgTotal}
                pageSize={orgPageSize}
                isFetching={orgQuery.isFetching}
                onPageChange={setOrgPage}
                onPageSizeChange={(size) => {
                  setOrgPageSize(size)
                  setOrgPage(1)
                }}
                onRefresh={invalidateAll}
              />
            </section>
          )}

          {/* Built-in Templates */}
          {builtInTotal > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Global Templates</h2>
                <Badge variant="secondary">{builtInTotal}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {builtInTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    canManage={sysAdmin}
                    onDelete={() => deleteMutation.mutate(t.id)}
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </div>
              <PaginationBar
                page={builtInPage}
                totalPages={builtInTotalPages}
                total={builtInTotal}
                pageSize={builtInPageSize}
                isFetching={builtInQuery.isFetching}
                onPageChange={setBuiltInPage}
                onPageSizeChange={(size) => {
                  setBuiltInPageSize(size)
                  setBuiltInPage(1)
                }}
                onRefresh={invalidateAll}
              />
            </section>
          )}
        </>
      )}

      {/* Create Template Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) resetCreate()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Add a custom retrospective template for your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Team Health Check"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What is this template for?"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                className="min-h-16 resize-none"
              />
            </div>

            {sysAdmin ? (
              <div className="space-y-1.5">
                <Label>Organization (optional)</Label>
                <Select
                  value={createOrgId || '__global__'}
                  onValueChange={(v) =>
                    setCreateOrgId(v === '__global__' ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">
                      Global (all users)
                    </SelectItem>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              adminOrgs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Organization *</Label>
                  <Select value={createOrgId} onValueChange={setCreateOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Columns *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCreateColumns((c) => [
                      ...c,
                      { name: '', emoji: '', prompt: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Column
                </Button>
              </div>
              {createColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        className="w-14 text-center text-lg px-1"
                        placeholder="😀"
                        value={col.emoji}
                        maxLength={2}
                        onChange={(e) =>
                          setCreateColumns((c) =>
                            c.map((cc, j) =>
                              j === i ? { ...cc, emoji: e.target.value } : cc,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder="Column name *"
                        value={col.name}
                        onChange={(e) =>
                          setCreateColumns((c) =>
                            c.map((cc, j) =>
                              j === i ? { ...cc, name: e.target.value } : cc,
                            ),
                          )
                        }
                      />
                    </div>
                    <Input
                      placeholder="Prompt (optional)"
                      value={col.prompt}
                      onChange={(e) =>
                        setCreateColumns((c) =>
                          c.map((cc, j) =>
                            j === i ? { ...cc, prompt: e.target.value } : cc,
                          ),
                        )
                      }
                    />
                  </div>
                  {createColumns.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mt-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setCreateColumns((c) => c.filter((_, j) => j !== i))
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !createName.trim() ||
                createColumns.filter((c) => c.name.trim()).length === 0 ||
                (!sysAdmin && !createOrgId)
              }
            >
              {createMutation.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  isFetching: boolean
  onPageChange: (p: number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
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
          size="sm"
          className="h-7 gap-1"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function TemplateCard({
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
