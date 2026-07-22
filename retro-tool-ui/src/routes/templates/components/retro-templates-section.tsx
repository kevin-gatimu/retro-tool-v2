import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Building2, History, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PaginationBar } from '@/components/pagination-bar'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Organization } from '@/common/types/organizations'
import type { ColumnDraft, TemplateWithColumns } from '../types'
import {
  fetchRetroTemplates,
  retroTemplatesQueryKey,
  useRetroTemplateMutations,
} from '../hooks'
import { TemplateCard } from './template-card'
import { CreateRetroTemplateDialog } from './create-retro-template-dialog'

const DEFAULT_PAGE_SIZE = 6

/** Retro templates tab on the `/templates` page: paginated org + global lists plus create. */
export function RetroTemplatesSection({ sysAdmin }: { sysAdmin: boolean }) {
  const queryClient = useQueryClient()

  const [orgPageSize, setOrgPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orgPage, setOrgPage] = useState(1)
  const [builtInPageSize, setBuiltInPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [builtInPage, setBuiltInPage] = useState(1)
  const [search, setSearch] = useState('')

  const builtInQuery = useQuery({
    queryKey: retroTemplatesQueryKey(
      'built-in',
      builtInPage,
      builtInPageSize,
      search,
    ),
    queryFn: () =>
      fetchRetroTemplates('built-in', builtInPage, builtInPageSize, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const orgQuery = useQuery({
    queryKey: retroTemplatesQueryKey(
      'organization',
      orgPage,
      orgPageSize,
      search,
    ),
    queryFn: () =>
      fetchRetroTemplates('organization', orgPage, orgPageSize, search),
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

  const { createMutation, deleteMutation } = useRetroTemplateMutations({
    onCreateSuccess: () => {
      setCreateOpen(false)
      resetCreate()
    },
  })

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['templates'] })

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

      <CreateRetroTemplateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) resetCreate()
        }}
        sysAdmin={sysAdmin}
        orgs={orgs}
        adminOrgs={adminOrgs}
        name={createName}
        onNameChange={setCreateName}
        desc={createDesc}
        onDescChange={setCreateDesc}
        orgId={createOrgId}
        onOrgIdChange={setCreateOrgId}
        columns={createColumns}
        onColumnsChange={setCreateColumns}
        onCancel={() => setCreateOpen(false)}
        onSubmit={() =>
          createMutation.mutate({
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
          })
        }
        isPending={createMutation.isPending}
      />
    </div>
  )
}
