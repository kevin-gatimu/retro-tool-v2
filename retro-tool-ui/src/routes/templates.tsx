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
  Eye,
  History,
  Plus,
  RefreshCw,
  Search,
  Spade,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TemplatesListSkeleton } from './templates.skeleton'
import type { Template } from '@/common/types/templates'
import type { Organization } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'
import type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
  CreateEstimateTemplateInput,
} from '@/common/types/estimates'
import {
  TShirtIcon,
  getShirtScale,
  isTShirtTemplateName,
} from '@/components/t-shirt-icon'
import { api } from '@/lib/api'
import {
  ESTIMATE_TEMPLATES_ENDPOINTS,
  ORGANIZATIONS_ENDPOINTS,
  RETROS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
  TEAMS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/use-current-user'

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
type EstimateValueDraft = {
  label: string
  value: string
  color: string
  description: string
}

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

function buildEstimateTemplatesQueryKey(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
  search: string,
) {
  return ['estimate-templates', type, page, limit, search] as const
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

function fetchEstimateTemplates(
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

  return api.get<PaginatedEstimateTemplatesResponse>(
    `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?${params.toString()}`,
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
      queryClient.ensureQueryData({
        queryKey: buildEstimateTemplatesQueryKey(
          'built-in',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () =>
          fetchEstimateTemplates('built-in', 1, DEFAULT_PAGE_SIZE, ''),
      }),
      queryClient.ensureQueryData({
        queryKey: buildEstimateTemplatesQueryKey(
          'organization',
          1,
          DEFAULT_PAGE_SIZE,
          '',
        ),
        queryFn: () =>
          fetchEstimateTemplates('organization', 1, DEFAULT_PAGE_SIZE, ''),
      }),
    ]),
  pendingComponent: TemplatesListSkeleton,
  component: TemplatesPage,
})

function TemplatesPage() {
  const { data: user } = useCurrentUser()
  const sysAdmin = user?.role ? isSystemAdmin(user.role) : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Browse and manage retrospective and estimate templates
        </p>
      </div>

      <Tabs defaultValue="retro">
        <TabsList>
          <TabsTrigger value="retro">
            <History className="h-4 w-4 mr-2" />
            Retro Templates
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Spade className="h-4 w-4 mr-2" />
            Story Estimate Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retro" className="mt-6">
          <RetroTemplatesSection sysAdmin={sysAdmin} />
        </TabsContent>

        <TabsContent value="estimate" className="mt-6">
          <EstimateTemplatesSection sysAdmin={sysAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Retro Templates Section (existing functionality extracted)
// ============================================================================

function RetroTemplatesSection({ sysAdmin }: { sysAdmin: boolean }) {
  const queryClient = useQueryClient()

  const [orgPageSize, setOrgPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orgPage, setOrgPage] = useState(1)
  const [builtInPageSize, setBuiltInPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [builtInPage, setBuiltInPage] = useState(1)
  const [search, setSearch] = useState('')

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
        <div className="max-w-sm flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setOrgPage(1)
                setBuiltInPage(1)
              }}
              placeholder="Search retro templates"
              className="pl-9"
            />
          </div>
        </div>
        {canCreateOrgTemplate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">No templates available</CardTitle>
            <CardDescription className="text-center">
              Templates will appear here once they are created.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
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

          {builtInTotal > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
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
                maxCharacters={40}
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
                        maxCharacters={40}
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

// ============================================================================
// Estimate Templates Section
// ============================================================================

function EstimateTemplatesSection({ sysAdmin }: { sysAdmin: boolean }) {
  const queryClient = useQueryClient()

  const [orgPageSize, setOrgPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orgPage, setOrgPage] = useState(1)
  const [builtInPageSize, setBuiltInPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [builtInPage, setBuiltInPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () =>
      api.get<{ organizations: Organization[] }>(ORGANIZATIONS_ENDPOINTS.LIST),
  })
  const orgs = orgsData?.organizations ?? []
  const adminOrgs = orgs.filter(
    (o) => o.myRole === 'org-owner' || o.myRole === 'org-admin',
  )

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
  })
  const isTeamLead =
    teamsData?.teams.some((t) => t.myRole === 'team-lead') ?? false
  const canCreate = sysAdmin || adminOrgs.length > 0 || isTeamLead

  const builtInQuery = useQuery({
    queryKey: buildEstimateTemplatesQueryKey(
      'built-in',
      builtInPage,
      builtInPageSize,
      search,
    ),
    queryFn: () =>
      fetchEstimateTemplates('built-in', builtInPage, builtInPageSize, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const orgQuery = useQuery({
    queryKey: buildEstimateTemplatesQueryKey(
      'organization',
      orgPage,
      orgPageSize,
      search,
    ),
    queryFn: () =>
      fetchEstimateTemplates('organization', orgPage, orgPageSize, search),
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

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['estimate-templates'] })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EstimateTemplate | null>(
    null,
  )
  const [viewingTemplate, setViewingTemplate] =
    useState<EstimateTemplate | null>(null)

  const canManage = (t: EstimateTemplate) => {
    if (sysAdmin) return true
    if (!t.organizationId) return false
    return (
      adminOrgs.some((o) => o.id === t.organizationId) ||
      (isTeamLead &&
        (teamsData?.teams.some(
          (team) =>
            team.organizationId === t.organizationId &&
            team.myRole === 'team-lead',
        ) ??
          false))
    )
  }

  const isEmpty =
    builtInTotal === 0 &&
    orgTotal === 0 &&
    !builtInQuery.isFetching &&
    !orgQuery.isFetching

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="max-w-sm flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setOrgPage(1)
                setBuiltInPage(1)
              }}
              placeholder="Search estimate templates"
              className="pl-9"
            />
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Spade className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">
              No estimate templates available
            </CardTitle>
            <CardDescription className="text-center">
              Templates will appear here once they are created or seeded.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
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
                  <EstimateTemplateCardWrapper
                    key={t.id}
                    template={t}
                    canManage={canManage(t)}
                    onView={() => setViewingTemplate(t)}
                    onEdit={() => setEditTemplate(t)}
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

          {builtInTotal > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Spade className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Global Templates</h2>
                <Badge variant="secondary">{builtInTotal}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {builtInTemplates.map((t) => (
                  <EstimateTemplateCardWrapper
                    key={t.id}
                    template={t}
                    canManage={sysAdmin}
                    onView={() => setViewingTemplate(t)}
                    onEdit={() => setEditTemplate(t)}
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

      <CreateEstimateTemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sysAdmin={sysAdmin}
        adminOrgs={adminOrgs}
        isTeamLead={isTeamLead}
        allOrgs={orgs}
        teamsData={teamsData?.teams ?? []}
        onSuccess={() => {
          setCreateOpen(false)
          invalidateAll()
        }}
      />

      {editTemplate && (
        <EditEstimateTemplateDialog
          template={editTemplate}
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          onSuccess={() => {
            setEditTemplate(null)
            invalidateAll()
          }}
        />
      )}

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
    </div>
  )
}

// ============================================================================
// Estimate Template Card Wrapper (with delete confirm)
// ============================================================================

function EstimateTemplateCardWrapper({
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

// ============================================================================
// Create Estimate Template Dialog
// ============================================================================

function CreateEstimateTemplateDialog({
  open,
  onClose,
  sysAdmin,
  adminOrgs,
  isTeamLead,
  allOrgs,
  teamsData,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  sysAdmin: boolean
  adminOrgs: Organization[]
  isTeamLead: boolean
  allOrgs: Organization[]
  teamsData: Team[]
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [orgId, setOrgId] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [values, setValues] = useState<EstimateValueDraft[]>([
    { label: '', value: '', color: '', description: '' },
  ])

  const reset = () => {
    setName('')
    setDesc('')
    setOrgId('')
    setColor('#6366f1')
    setValues([{ label: '', value: '', color: '', description: '' }])
  }

  const eligibleOrgs = sysAdmin
    ? allOrgs
    : adminOrgs.length > 0
      ? adminOrgs
      : isTeamLead
        ? allOrgs.filter((o) =>
            teamsData.some(
              (t) => t.organizationId === o.id && t.myRole === 'team-lead',
            ),
          )
        : []

  const createMutation = useMutation({
    mutationFn: () => {
      const body: CreateEstimateTemplateInput = {
        name: name.trim(),
        description: desc.trim() || undefined,
        organizationId: orgId || undefined,
        color: color || undefined,
        values: values
          .filter((v) => v.label.trim() && v.value.trim())
          .map((v, i) => ({
            label: v.label.trim(),
            value: v.value.trim(),
            order: i,
            color: v.color || undefined,
            description: v.description.trim() || undefined,
          })),
      }
      return api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, body)
    },
    onSuccess: () => {
      toast.success('Estimate template created')
      reset()
      onSuccess()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create template'),
  })

  const validValues = values.filter((v) => v.label.trim() && v.value.trim())
  const canSubmit =
    name.trim().length > 0 && validValues.length > 0 && (sysAdmin || !!orgId)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Estimate Template</DialogTitle>
          <DialogDescription>
            Define a custom voting scale for story estimation sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. My Fibonacci"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe when to use this template"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              {sysAdmin ? (
                <>
                  <Label>Organization (optional)</Label>
                  <Select
                    value={orgId || '__global__'}
                    onValueChange={(v) => setOrgId(v === '__global__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">
                        Global (all users)
                      </SelectItem>
                      {allOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Label>Organization *</Label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
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
            <div className="text-xs text-muted-foreground">
              Label = displayed in UI. Value = stored in votes (use numbers for
              stats).
            </div>
            {values.map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="space-y-1 w-24">
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
                    <div className="space-y-1 w-24">
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
                        className="h-9 w-10 cursor-pointer rounded border border-input p-0.5"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
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
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmit}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Edit Estimate Template Dialog
// ============================================================================

function EditEstimateTemplateDialog({
  template,
  open,
  onClose,
  onSuccess,
}: {
  template: EstimateTemplate
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(template.name)
  const [desc, setDesc] = useState(template.description ?? '')
  const [color, setColor] = useState(template.color ?? '#6366f1')
  const [values, setValues] = useState<EstimateValueDraft[]>(
    template.values
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((v) => ({
        label: v.label,
        value: v.value,
        color: v.color ?? '',
        description: v.description ?? '',
      })),
  )

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(template.id), {
        name: name.trim(),
        description: desc.trim() || null,
        color: color || null,
        values: values
          .filter((v) => v.label.trim() && v.value.trim())
          .map((v, i) => ({
            label: v.label.trim(),
            value: v.value.trim(),
            order: i,
            color: v.color || null,
            description: v.description.trim() || null,
          })),
      }),
    onSuccess: () => {
      toast.success('Template updated')
      onSuccess()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to update template'),
  })

  const validValues = values.filter((v) => v.label.trim() && v.value.trim())
  const canSubmit = name.trim().length > 0 && validValues.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Estimate Template</DialogTitle>
          <DialogDescription>
            Update the template name, description, and values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
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
            {values.map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="space-y-1 w-24">
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
                    <div className="space-y-1 w-24">
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
                        className="h-9 w-10 cursor-pointer rounded border border-input p-0.5"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
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
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !canSubmit}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Shared sub-components
// ============================================================================

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
