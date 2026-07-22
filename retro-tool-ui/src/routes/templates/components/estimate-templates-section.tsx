import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Building2, Plus, Search, Spade } from 'lucide-react'
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
import {
  EstimateTemplateFormDialog,
  TemplateViewDialog,
} from '@/components/templates'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Organization } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'
import type { EstimateTemplate } from '../types'
import {
  estimateTemplatesQueryKey,
  fetchEstimateTemplates,
  useEstimateTemplateMutations,
} from '../hooks'
import { resolveEligibleOrgs } from '../helpers'
import { EstimateTemplateCardWrapper } from './estimate-template-card-wrapper'

const DEFAULT_PAGE_SIZE = 6

/** Story estimate templates tab on the `/templates` page. */
export function EstimateTemplatesSection({ sysAdmin }: { sysAdmin: boolean }) {
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
    queryKey: estimateTemplatesQueryKey(
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
    queryKey: estimateTemplatesQueryKey(
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

  const { createMutation, updateMutation, deleteMutation } =
    useEstimateTemplateMutations({
      onCreateSuccess: () => setCreateOpen(false),
      onUpdateSuccess: () => setEditTemplate(null),
    })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EstimateTemplate | null>(
    null,
  )
  const [viewingTemplate, setViewingTemplate] =
    useState<EstimateTemplate | null>(null)

  const eligibleOrgs = resolveEligibleOrgs({
    sysAdmin,
    adminOrgs,
    isTeamLead,
    allOrgs: orgs,
    teams: teamsData?.teams ?? [],
  })

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

      {createOpen && (
        <EstimateTemplateFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          orgSelect={{
            orgs: sysAdmin ? orgs : eligibleOrgs,
            allowGlobal: sysAdmin,
            required: !sysAdmin,
          }}
          onSubmit={(draft) =>
            createMutation.mutate({
              name: draft.name,
              description: draft.description || undefined,
              organizationId: draft.organizationId || undefined,
              color: draft.color || undefined,
              values: draft.values.map((v, i) => ({
                label: v.label,
                value: v.value,
                order: i,
                color: v.color || undefined,
                description: v.description || undefined,
              })),
            })
          }
          isPending={createMutation.isPending}
        />
      )}

      {editTemplate && (
        <EstimateTemplateFormDialog
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          template={editTemplate}
          onSubmit={(draft) =>
            updateMutation.mutate({
              id: editTemplate.id,
              body: {
                name: draft.name,
                description: draft.description || null,
                color: draft.color || null,
                values: draft.values.map((v, i) => ({
                  label: v.label,
                  value: v.value,
                  order: i,
                  color: v.color || null,
                  description: v.description || null,
                })),
              },
            })
          }
          isPending={updateMutation.isPending}
        />
      )}

      <TemplateViewDialog
        template={viewingTemplate}
        open={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
      />
    </div>
  )
}
