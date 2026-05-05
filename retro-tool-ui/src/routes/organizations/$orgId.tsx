import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useOrgDetailMutations } from './hooks/useOrganizationMutations'
import { useOrgTeamRoleMutations } from './hooks/useOrgTeamRoleMutations'
import { OrgLogo } from '@/components/OrgLogo'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Clock,
  Edit,
  FileText,
  Layers,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getOrgMemberColumns } from '@/components/tables/member-columns'
import type { OrgMemberRow } from '@/components/tables/member-columns'
import { getOrgRoleBadge } from '@/components/UserRoleBadges'
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
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  ESTIMATE_TEMPLATES_ENDPOINTS,
  ORGANIZATIONS_ENDPOINTS,
  TEAM_ROLES_ENDPOINTS,
  TEAMS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { CreateTemplateInput, Template } from '@/common/types/templates'
import type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
  CreateEstimateTemplateInput,
} from '@/common/types/estimates'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { OrganizationDetail } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'

function OrgDetailSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      <Skeleton className="h-5 w-40" />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-10" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/organizations/$orgId')({
  loader: ({ context: { queryClient }, params: { orgId } }) =>
    queryClient.ensureQueryData({
      queryKey: ['organization', orgId] as const,
      queryFn: () =>
        api.get<OrganizationDetail>(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId)),
    }),
  pendingComponent: OrgDetailSkeleton,
  component: OrganizationDetailPage,
})

function OrganizationDetailPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()

  const { data: organization } = useSuspenseQuery({
    queryKey: ['organization', orgId],
    queryFn: () =>
      api.get<OrganizationDetail>(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId)),
  })

  const { data: teamsData } = useQuery({
    queryKey: ['org-teams', orgId],
    queryFn: () =>
      api.get<{ teams: Team[] }>(
        `${TEAMS_ENDPOINTS.LIST}?organizationId=${orgId}`,
      ),
    enabled: !!organization,
  })
  const teams = teamsData?.teams ?? []

  // Fetch the current user's own teams (includes correct myRole/tag)
  const { data: myTeamsData } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    enabled: !!organization,
    staleTime: 30_000,
  })
  const isTeamLeadInOrg =
    myTeamsData?.teams.some(
      (t) => t.organizationId === orgId && t.myRole === 'team-lead',
    ) ?? false

  const [activeTab, setActiveTab] = useState('teams')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)
  const [memberRowSelection, setMemberRowSelection] = useState<
    Record<string, boolean>
  >({})
  const selectedMemberIds = Object.keys(memberRowSelection).filter(
    (id) => memberRowSelection[id],
  )

  const [editName, setEditName] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<
    'org-owner' | 'org-admin' | 'member'
  >('member')
  const [inviteEmailCheck, setInviteEmailCheck] = useState<{
    registered: boolean
    name?: string
  } | null>(null)
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<
    'org-owner' | 'org-admin' | 'member'
  >('member')
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [teamEmoji, setTeamEmoji] = useState('👥')

  // Template management state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  )
  const [tplName, setTplName] = useState('')
  const [tplDescription, setTplDescription] = useState('')
  const [tplColumns, setTplColumns] = useState<
    Array<{ name: string; emoji: string; prompt: string; order: number }>
  >([
    { name: '', emoji: '', prompt: '', order: 0 },
    { name: '', emoji: '', prompt: '', order: 1 },
    { name: '', emoji: '', prompt: '', order: 2 },
  ])
  const [tplFormError, setTplFormError] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  )

  // Team roles tab state
  const [roleCreateOpen, setRoleCreateOpen] = useState(false)
  const [roleEditTarget, setRoleEditTarget] = useState<{
    id: string
    name: string
    sortOrder: number
    isBuiltIn: boolean
  } | null>(null)
  const [roleFormName, setRoleFormName] = useState('')
  const [roleFormSortOrder, setRoleFormSortOrder] = useState(0)
  const [roleDeleteId, setRoleDeleteId] = useState<string | null>(null)

  const viewerIsSystemAdmin = currentUser?.role
    ? isSystemAdmin(currentUser.role)
    : false
  const isOwner = organization.myRole === 'org-owner'
  const isAdmin =
    viewerIsSystemAdmin || organization.myRole === 'org-admin' || isOwner
  const canDeleteOrganization = viewerIsSystemAdmin || isOwner
  const canLeaveOrganization = !viewerIsSystemAdmin && !isOwner

  const {
    updateOrgMutation,
    deleteOrgMutation,
    leaveOrgMutation,
    inviteOrgMemberMutation,
    addOrgMemberMutation,
    updateRoleMutation,
    removeMemberMutation,
    createTeamMutation,
    deleteTeamMutation,
  } = useOrgDetailMutations(orgId)

  const {
    createCustomRoleMutation,
    updateCustomRoleMutation,
    deleteCustomRoleMutation,
    toggleActivationMutation,
  } = useOrgTeamRoleMutations(orgId)

  interface OrgTeamRoleAdminResponse {
    builtIn: Array<{
      id: string
      name: string
      isBuiltIn: boolean
      isActive: boolean
      sortOrder: number
      orgIsActive: boolean
    }>
    custom: Array<{
      id: string
      name: string
      isBuiltIn: boolean
      isActive: boolean
      sortOrder: number
    }>
  }

  const { data: orgRolesData } = useQuery<OrgTeamRoleAdminResponse>({
    queryKey: ['org-team-roles', orgId],
    queryFn: () =>
      api.get<OrgTeamRoleAdminResponse>(
        TEAM_ROLES_ENDPOINTS.ORG_ADMIN_LIST(orgId),
      ),
    enabled: isAdmin,
  })

  const userSearchQuery = useQuery({
    queryKey: ['user-search', addMemberSearch],
    queryFn: () =>
      api.get<
        Array<{ id: string; name: string; email: string; image: string | null }>
      >(`${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(addMemberSearch)}`),
    enabled: addMemberSearch.length >= 2,
  })

  const requestToJoinTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      api.post(TEAMS_ENDPOINTS.JOIN_REQUESTS(teamId), {}),
    onSuccess: () => {
      toast.success('Join request sent')
      queryClient.invalidateQueries({ queryKey: ['org-teams', orgId] })
    },
    onError: (error) => toast.error(error.message || 'Failed to send request'),
  })

  const bulkRemoveMembersMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedMemberIds.map((userId) =>
          api.delete(ORGANIZATIONS_ENDPOINTS.MEMBER_BY_ID(orgId, userId)),
        ),
      ),
    onSuccess: () => {
      toast.success(`${selectedMemberIds.length} member(s) removed`)
      setMemberRowSelection({})
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to remove members'),
  })

  const orgMembers = organization.members

  // Close create team dialog and reset form on successful creation
  useEffect(() => {
    if (createTeamMutation.isSuccess) {
      setIsCreateTeamOpen(false)
      setTeamName('')
      setTeamDescription('')
      setTeamEmoji('👥')
    }
  }, [createTeamMutation.isSuccess])

  // Close delete team dialog on successful deletion
  useEffect(() => {
    if (deleteTeamMutation.isSuccess) {
      setDeleteTeamId(null)
    }
  }, [deleteTeamMutation.isSuccess])

  // Templates query (org-scoped)
  const templatesQuery = useQuery({
    queryKey: ['org-templates', orgId],
    queryFn: () =>
      api
        .get<{
          templates: Template[]
        }>(`${TEMPLATES_ENDPOINTS.LIST}?type=organization&page=1&limit=100`)
        .then((r) => r.templates.filter((t) => t.organizationId === orgId)),
  })
  const orgTemplates = templatesQuery.data ?? []

  const sortedTplColumns = useMemo(
    () => [...tplColumns].sort((a, b) => a.order - b.order),
    [tplColumns],
  )

  const resetTplForm = () => {
    setEditingTemplateId(null)
    setTplName('')
    setTplDescription('')
    setTplColumns([
      { name: '', emoji: '', prompt: '', order: 0 },
      { name: '', emoji: '', prompt: '', order: 1 },
      { name: '', emoji: '', prompt: '', order: 2 },
    ])
    setTplFormError(null)
  }

  const openCreateTemplateDialog = () => {
    resetTplForm()
    setTemplateDialogOpen(true)
  }

  const openEditTemplateDialog = async (template: Template) => {
    setEditingTemplateId(template.id)
    setTplName(template.name)
    setTplDescription(template.description ?? '')
    try {
      const full = await api.get<
        Template & {
          columns: Array<{
            name: string
            emoji: string | null
            prompt: string | null
            order: number
          }>
        }
      >(TEMPLATES_ENDPOINTS.BY_ID(template.id))
      setTplColumns(
        full.columns.length > 0
          ? full.columns
              .sort((a, b) => a.order - b.order)
              .map((c) => ({
                name: c.name,
                emoji: c.emoji ?? '',
                prompt: c.prompt ?? '',
                order: c.order,
              }))
          : [{ name: '', emoji: '', prompt: '', order: 0 }],
      )
    } catch {
      setTplColumns([{ name: '', emoji: '', prompt: '', order: 0 }])
    }
    setTplFormError(null)
    setTemplateDialogOpen(true)
  }

  const createTemplateMutation = useMutation({
    mutationFn: (payload: CreateTemplateInput) =>
      api.post(TEMPLATES_ENDPOINTS.LIST, payload),
    onSuccess: async () => {
      toast.success('Template created')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateDialogOpen(false)
      resetTplForm()
    },
    onError: (e: Error) =>
      setTplFormError(e.message || 'Failed to create template'),
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<CreateTemplateInput>
    }) => api.patch(TEMPLATES_ENDPOINTS.BY_ID(id), payload),
    onSuccess: async () => {
      toast.success('Template updated')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateDialogOpen(false)
      resetTplForm()
    },
    onError: (e: Error) =>
      setTplFormError(e.message || 'Failed to update template'),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: async () => {
      toast.success('Template deleted')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateToDelete(null)
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  const submitTemplate = () => {
    const trimmedName = tplName.trim()
    if (!trimmedName) {
      setTplFormError('Template name is required')
      return
    }
    const cleanedColumns = sortedTplColumns
      .map((c, i) => ({
        name: c.name.trim(),
        emoji: c.emoji.trim() || undefined,
        prompt: c.prompt.trim() || undefined,
        order: i,
      }))
      .filter((c) => c.name.length > 0)
    if (cleanedColumns.length === 0) {
      setTplFormError('At least one column is required')
      return
    }
    const payload: CreateTemplateInput = {
      name: trimmedName,
      description: tplDescription.trim() || undefined,
      organizationId: orgId,
      columns: cleanedColumns,
    }
    if (editingTemplateId) {
      updateTemplateMutation.mutate({ id: editingTemplateId, payload })
    } else {
      createTemplateMutation.mutate(payload)
    }
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/organizations"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Organizations
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <OrgLogo
              logo={organization.logo}
              name={organization.name}
              height={32}
              tight
            />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {organization.name}
              </h1>
              <p className="text-muted-foreground">/{organization.slug}</p>
            </div>
            {getOrgRoleBadge(organization.myRole, currentUser?.role)}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditName(organization.name)
                    setEditLogo(organization.logo ?? '')
                    setIsEditOpen(true)
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Organization
                </DropdownMenuItem>
              )}
              {canLeaveOrganization && (
                <DropdownMenuItem
                  onClick={() => setLeaveConfirmOpen(true)}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Organization
                </DropdownMenuItem>
              )}
              {canDeleteOrganization && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Organization
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="team-roles">Team Roles</TabsTrigger>}
          {(isAdmin || isTeamLeadInOrg) && (
            <TabsTrigger value="templates">Templates</TabsTrigger>
          )}
        </TabsList>

        {/* Teams Tab */}
        <TabsContent value="teams" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Teams</h2>
            {isAdmin && (
              <Dialog
                open={isCreateTeamOpen}
                onOpenChange={setIsCreateTeamOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogDescription>
                      Create a new team within this organization.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (teamName && !createTeamMutation.isPending)
                        createTeamMutation.mutate({
                          name: teamName,
                          description: teamDescription,
                          emoji: teamEmoji,
                        })
                    }}
                  >
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="emoji">Emoji</Label>
                        <Input
                          id="emoji"
                          value={teamEmoji}
                          onChange={(e) => setTeamEmoji(e.target.value)}
                          className="w-20"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="teamName">Name</Label>
                        <Input
                          id="teamName"
                          placeholder="Engineering"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="teamDescription">Description</Label>
                        <Textarea
                          id="teamDescription"
                          placeholder="Our awesome engineering team"
                          value={teamDescription}
                          onChange={(e) => setTeamDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateTeamOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!teamName || createTeamMutation.isPending}
                      >
                        {createTeamMutation.isPending
                          ? 'Creating...'
                          : 'Create'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No teams yet</h3>
                <p className="mb-4 text-center text-muted-foreground">
                  Create teams to organize members and run retrospectives.
                </p>
                {isAdmin && (
                  <Button onClick={() => setIsCreateTeamOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Team
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="group cursor-pointer transition-colors hover:bg-accent/30 hover:ring-1 hover:ring-primary/30"
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, textarea, select, [role="menuitem"]',
                      )
                    ) {
                      return
                    }

                    void navigate({
                      to: '/teams/$teamId',
                      params: { teamId: team.id },
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    const target = e.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, textarea, select, [role="menuitem"]',
                      )
                    ) {
                      return
                    }

                    e.preventDefault()
                    void navigate({
                      to: '/teams/$teamId',
                      params: { teamId: team.id },
                    })
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open team ${team.name}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{team.emoji}</span>
                        <div>
                          <CardTitle className="text-lg">
                            <Link
                              to="/teams/$teamId"
                              params={{ teamId: team.id }}
                              className="hover:underline"
                            >
                              {team.name}
                            </Link>
                          </CardTitle>
                          {team.description && (
                            <CardDescription className="line-clamp-2">
                              {team.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDeleteTeamId(team.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {team.memberCount ?? 0}{' '}
                          {team.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      {team.isMember ? (
                        <Badge variant="secondary">Joined</Badge>
                      ) : team.hasPendingRequest ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-600 border-amber-400"
                        >
                          <Clock className="h-3 w-3" />
                          Request Pending
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-emerald-600 border-emerald-500 hover:bg-emerald-50"
                          onClick={() =>
                            requestToJoinTeamMutation.mutate(team.id)
                          }
                          disabled={requestToJoinTeamMutation.isPending}
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Request to Join
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Members ({orgMembers.length})
            </h2>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  {/* Invite by Email */}
                  <Dialog
                    open={isInviteOpen}
                    onOpenChange={(open) => {
                      setIsInviteOpen(open)
                      if (!open) {
                        setInviteEmail('')
                        setInviteRole('member')
                        setInviteEmailCheck(null)
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Mail className="mr-2 h-4 w-4" />
                        Invite
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Member by Email</DialogTitle>
                        <DialogDescription>
                          Send an invitation email. Works for both registered
                          and new users.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (inviteEmail && !inviteOrgMemberMutation.isPending)
                            inviteOrgMemberMutation.mutate(
                              { email: inviteEmail, role: inviteRole },
                              {
                                onSuccess: () => {
                                  setIsInviteOpen(false)
                                  setInviteEmail('')
                                  setInviteRole('member')
                                  setInviteEmailCheck(null)
                                },
                              },
                            )
                        }}
                      >
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="invite-email">Email</Label>
                            <Input
                              id="invite-email"
                              type="email"
                              placeholder="user@example.com"
                              value={inviteEmail}
                              onChange={(e) => {
                                setInviteEmail(e.target.value)
                                setInviteEmailCheck(null)
                              }}
                              onBlur={async () => {
                                if (!inviteEmail) return
                                try {
                                  const result = await api.get<{
                                    registered: boolean
                                    name?: string
                                  }>(
                                    `${ORGANIZATIONS_ENDPOINTS.CHECK_INVITE_EMAIL(orgId)}?email=${encodeURIComponent(inviteEmail)}`,
                                  )
                                  setInviteEmailCheck(result)
                                } catch {
                                  setInviteEmailCheck(null)
                                }
                              }}
                            />
                            {inviteEmailCheck !== null && (
                              <p
                                className={`text-xs ${inviteEmailCheck.registered ? 'text-emerald-400' : 'text-gray-400'}`}
                              >
                                {inviteEmailCheck.registered
                                  ? `Account found${inviteEmailCheck.name ? ` (${inviteEmailCheck.name})` : ''} — invitation email will be sent`
                                  : 'No account found — invitation email will be sent to register'}
                              </p>
                            )}
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="invite-role">Role</Label>
                            <Select
                              value={inviteRole}
                              onValueChange={(v: string) =>
                                setInviteRole(
                                  v as 'org-owner' | 'org-admin' | 'member',
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="org-admin">
                                  Admin (Org)
                                </SelectItem>
                                {isOwner && (
                                  <SelectItem value="org-owner">
                                    Owner (Org)
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsInviteOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={
                              !inviteEmail || inviteOrgMemberMutation.isPending
                            }
                          >
                            {inviteOrgMemberMutation.isPending
                              ? 'Sending...'
                              : 'Send Invite'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Add Member directly */}
                  <Dialog
                    open={isAddMemberOpen}
                    onOpenChange={(open) => {
                      setIsAddMemberOpen(open)
                      if (!open) {
                        setAddMemberSearch('')
                        setAddMemberUserId('')
                        setAddMemberRole('member')
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                        <DialogDescription>
                          Directly add an existing user without sending an
                          email.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Search user</Label>
                          <Input
                            placeholder="Name or email…"
                            value={addMemberSearch}
                            onChange={(e) => {
                              setAddMemberSearch(e.target.value)
                              setAddMemberUserId('')
                            }}
                          />
                          {userSearchQuery.data &&
                            userSearchQuery.data.length > 0 &&
                            !addMemberUserId && (
                              <div className="border border-[#30363d] rounded-md divide-y divide-[#30363d] max-h-40 overflow-y-auto">
                                {userSearchQuery.data
                                  .filter(
                                    (u) =>
                                      !orgMembers.some(
                                        (m) => m.userId === u.id,
                                      ),
                                  )
                                  .map((u) => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#21262d] flex items-center gap-2"
                                      onClick={() => {
                                        setAddMemberUserId(u.id)
                                        setAddMemberSearch(u.name)
                                      }}
                                    >
                                      <span className="font-medium text-white">
                                        {u.name}
                                      </span>
                                      <span className="text-gray-400">
                                        {u.email}
                                      </span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          {addMemberUserId && (
                            <p className="text-xs text-emerald-400">
                              User selected
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label>Role</Label>
                          <Select
                            value={addMemberRole}
                            onValueChange={(v: string) =>
                              setAddMemberRole(
                                v as 'org-owner' | 'org-admin' | 'member',
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="org-admin">
                                Admin (Org)
                              </SelectItem>
                              {isOwner && (
                                <SelectItem value="org-owner">
                                  Owner (Org)
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsAddMemberOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={
                            !addMemberUserId || addOrgMemberMutation.isPending
                          }
                          onClick={() =>
                            addOrgMemberMutation.mutate(
                              { userId: addMemberUserId, role: addMemberRole },
                              { onSuccess: () => setIsAddMemberOpen(false) },
                            )
                          }
                        >
                          {addOrgMemberMutation.isPending
                            ? 'Adding...'
                            : 'Add Member'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          <DataTable
            columns={getOrgMemberColumns({
              isAdmin: !!isAdmin,
              onUpdateRole: (userId, role) =>
                updateRoleMutation.mutate({ userId, role }),
              onRemove: (userId) => setRemoveMemberId(userId),
            })}
            data={orgMembers as OrgMemberRow[]}
            searchColumn="user"
            searchPlaceholder="Search members..."
            pagination
            defaultPageSize={10}
            selectable={isAdmin}
            rowSelection={memberRowSelection}
            onRowSelectionChange={setMemberRowSelection}
            getRowId={(row) => row.userId}
            onRefresh={() =>
              queryClient.invalidateQueries({
                queryKey: ['organization', orgId],
              })
            }
          />
          {isAdmin && selectedMemberIds.length > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {selectedMemberIds.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => bulkRemoveMembersMutation.mutate()}
                disabled={bulkRemoveMembersMutation.isPending}
              >
                Remove Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMemberRowSelection({})}
              >
                Clear
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Team Roles Tab */}
        {isAdmin && (
          <TabsContent value="team-roles" className="mt-6 space-y-6">
            {/* Built-in roles section */}
            <div>
              <h2 className="text-xl font-semibold mb-1">Built-in Roles</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Toggle which global roles are available in this organisation.
              </p>
              <div className="divide-y border rounded-lg">
                {(orgRolesData?.builtIn ?? []).map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-medium">{role.name}</span>
                    <div className="flex items-center gap-2">
                      {!role.orgIsActive && (
                        <span className="text-xs text-muted-foreground">
                          Deactivated
                        </span>
                      )}
                      <Switch
                        checked={role.orgIsActive}
                        onCheckedChange={(checked) =>
                          toggleActivationMutation.mutate({
                            id: role.id,
                            isActive: checked,
                          })
                        }
                        disabled={toggleActivationMutation.isPending}
                      />
                    </div>
                  </div>
                ))}
                {(orgRolesData?.builtIn ?? []).length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No built-in roles configured.
                  </p>
                )}
              </div>
            </div>

            {/* Custom roles section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Custom Roles</h2>
                  <p className="text-sm text-muted-foreground">
                    Roles specific to this organisation.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRoleFormName('')
                    setRoleFormSortOrder((orgRolesData?.custom.length ?? 0) + 1)
                    setRoleCreateOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Custom Role
                </Button>
              </div>
              <div className="divide-y border rounded-lg">
                {(orgRolesData?.custom ?? []).map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-medium">{role.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRoleFormName(role.name)
                          setRoleFormSortOrder(role.sortOrder)
                          setRoleEditTarget({
                            id: role.id,
                            name: role.name,
                            sortOrder: role.sortOrder,
                            isBuiltIn: false,
                          })
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRoleDeleteId(role.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(orgRolesData?.custom ?? []).length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No custom roles yet.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Templates Tab */}
        {(isAdmin || isTeamLeadInOrg) && (
          <TabsContent value="templates" className="mt-6">
            <Tabs defaultValue="retro">
              <TabsList>
                <TabsTrigger value="retro">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Retro Templates
                </TabsTrigger>
                <TabsTrigger value="estimate">
                  <Layers className="h-4 w-4 mr-1.5" />
                  Story Estimates
                </TabsTrigger>
              </TabsList>

              {/* Retro Templates sub-tab */}
              {(isAdmin || isTeamLeadInOrg) && (
                <TabsContent value="retro" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Retro Templates</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage retro templates for this organisation.
                      </p>
                    </div>
                    <Button onClick={openCreateTemplateDialog} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      New Template
                    </Button>
                  </div>

                  {orgTemplates.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="font-medium">No templates yet</p>
                        <p className="text-sm text-muted-foreground">
                          Create your first org-specific template.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {orgTemplates.map((template) => (
                        <Card key={template.id}>
                          <CardHeader>
                            <CardTitle className="line-clamp-1">
                              {template.name}
                            </CardTitle>
                            {template.description && (
                              <CardDescription className="line-clamp-2">
                                {template.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditTemplateDialog(template)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setTemplateToDelete(template)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Delete
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Story Estimate Templates sub-tab */}
              <TabsContent value="estimate" className="mt-4">
                <OrgEstimateTemplatesSection
                  orgId={orgId}
                  canManage={isAdmin || isTeamLeadInOrg}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>

      {/* Org Custom Role — Create Dialog */}
      <Dialog open={roleCreateOpen} onOpenChange={setRoleCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Custom Role</DialogTitle>
            <DialogDescription>
              This role will only be available within this organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={roleFormName}
                onChange={(e) => setRoleFormName(e.target.value)}
                placeholder="e.g. Release Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={roleFormSortOrder}
                onChange={(e) => setRoleFormSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !roleFormName.trim() || createCustomRoleMutation.isPending
              }
              onClick={() => {
                createCustomRoleMutation.mutate(
                  { name: roleFormName.trim(), sortOrder: roleFormSortOrder },
                  { onSuccess: () => setRoleCreateOpen(false) },
                )
              }}
            >
              {createCustomRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Org Custom Role — Edit Dialog */}
      <Dialog
        open={roleEditTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRoleEditTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Role</DialogTitle>
            <DialogDescription>
              Update this organisation role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={roleFormName}
                onChange={(e) => setRoleFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={roleFormSortOrder}
                onChange={(e) => setRoleFormSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !roleFormName.trim() || updateCustomRoleMutation.isPending
              }
              onClick={() => {
                if (!roleEditTarget) return
                updateCustomRoleMutation.mutate(
                  {
                    id: roleEditTarget.id,
                    payload: {
                      name: roleFormName.trim(),
                      sortOrder: roleFormSortOrder,
                    },
                  },
                  { onSuccess: () => setRoleEditTarget(null) },
                )
              }}
            >
              {updateCustomRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Org Custom Role — Delete Confirmation */}
      <AlertDialog
        open={roleDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setRoleDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This role will be permanently removed. Deletion will be blocked if
              any team members are currently assigned this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (roleDeleteId)
                  deleteCustomRoleMutation.mutate(roleDeleteId, {
                    onSuccess: () => setRoleDeleteId(null),
                  })
              }}
            >
              {deleteCustomRoleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Delete Confirmation */}
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
                if (templateToDelete)
                  deleteTemplateMutation.mutate(templateToDelete.id)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Create / Edit Dialog */}
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open)
          if (!open) resetTplForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplateId ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Configure template details and columns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Start / Stop / Continue"
                maxCharacters={40}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTplColumns((c) => [
                      ...c,
                      { name: '', emoji: '', prompt: '', order: c.length },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Column
                </Button>
              </div>
              {sortedTplColumns.map((column, index) => (
                <Card key={`tpl-col-${index}`}>
                  <CardContent className="grid gap-3 p-4">
                    <div className="grid gap-3 md:grid-cols-[90px_1fr]">
                      <div className="space-y-1">
                        <Label>Emoji</Label>
                        <Input
                          value={column.emoji}
                          onChange={(e) =>
                            setTplColumns((c) => {
                              const n = [...c]
                              n[index] = { ...n[index], emoji: e.target.value }
                              return n
                            })
                          }
                          placeholder="😀"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                          value={column.name}
                          onChange={(e) =>
                            setTplColumns((c) => {
                              const n = [...c]
                              n[index] = { ...n[index], name: e.target.value }
                              return n
                            })
                          }
                          placeholder="What went well"
                          maxCharacters={40}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Prompt (optional)</Label>
                      <Textarea
                        value={column.prompt}
                        onChange={(e) =>
                          setTplColumns((c) => {
                            const n = [...c]
                            n[index] = { ...n[index], prompt: e.target.value }
                            return n
                          })
                        }
                        rows={2}
                        placeholder="Guide for this column"
                      />
                    </div>
                    {tplColumns.length > 1 && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setTplColumns((c) =>
                              c.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {tplFormError && (
              <p className="text-sm text-destructive">{tplFormError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false)
                resetTplForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitTemplate}
              disabled={
                createTemplateMutation.isPending ||
                updateTemplateMutation.isPending
              }
            >
              {createTemplateMutation.isPending ||
              updateTemplateMutation.isPending
                ? 'Saving...'
                : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update your organization details.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (editName && !updateOrgMutation.isPending)
                updateOrgMutation.mutate({ name: editName, logo: editLogo })
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editLogo">Logo URL</Label>
                <Input
                  id="editLogo"
                  placeholder="https://example.com/logo.png"
                  value={editLogo}
                  onChange={(e) => setEditLogo(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editName || updateOrgMutation.isPending}
              >
                {updateOrgMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{organization.name}" and all its
              teams. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOrgMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Organization Confirm */}
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to "{organization.name}" and all its teams.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveOrgMutation.mutate()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Team Confirm */}
      <AlertDialog
        open={!!deleteTeamId}
        onOpenChange={() => setDeleteTeamId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this team. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTeamId && deleteTeamMutation.mutate(deleteTeamId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirm */}
      <AlertDialog
        open={!!removeMemberId}
        onOpenChange={() => setRemoveMemberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This member will lose access to the organization and all its
              teams.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removeMemberId && removeMemberMutation.mutate(removeMemberId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// Org Estimate Templates Section
// ============================================================================

type EstimateValueDraft = {
  label: string
  value: string
  color: string
  description: string
}

function OrgEstimateTemplatesSection({
  orgId,
  canManage,
}: {
  orgId: string
  canManage: boolean
}) {
  const queryClient = useQueryClient()

  const queryKey = ['org-estimate-templates', orgId] as const

  const templatesQuery = useQuery({
    queryKey,
    queryFn: () =>
      api
        .get<PaginatedEstimateTemplatesResponse>(
          `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?type=organization&page=1&limit=100`,
        )
        .then((r) => r.templates.filter((t) => t.organizationId === orgId)),
    staleTime: 60_000,
  })
  const templates = templatesQuery.data ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EstimateTemplate | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<EstimateTemplate | null>(
    null,
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Story Estimate Templates</h2>
          <p className="text-sm text-muted-foreground">
            Custom voting scales for estimation sessions in this organisation.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No estimate templates yet</p>
            <p className="text-sm text-muted-foreground">
              Create a custom voting scale for your team.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const themeColor = t.color ?? '#6366f1'
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm truncate">{t.name}</CardTitle>
                  {t.description && (
                    <CardDescription className="text-xs mt-0.5 line-clamp-2">
                      {t.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.values.slice(0, 10).map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted"
                        style={{ color: themeColor }}
                      >
                        {v.label}
                      </span>
                    ))}
                    {t.values.length > 10 && (
                      <span className="text-xs text-muted-foreground">
                        +{t.values.length - 10}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTemplate(t)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <OrgEstimateTemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        onSuccess={() => {
          setCreateOpen(false)
          invalidate()
        }}
      />

      {editTemplate && (
        <OrgEstimateTemplateDialog
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          orgId={orgId}
          template={editTemplate}
          onSuccess={() => {
            setEditTemplate(null)
            invalidate()
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimate template?</AlertDialogTitle>
            <AlertDialogDescription>
              Sessions using this template will lose the template association,
              but all vote and round data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function OrgEstimateTemplateDialog({
  open,
  onClose,
  orgId,
  template,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  orgId: string
  template?: EstimateTemplate
  onSuccess: () => void
}) {
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [desc, setDesc] = useState(template?.description ?? '')
  const [color, setColor] = useState(template?.color ?? '#6366f1')
  const [values, setValues] = useState<EstimateValueDraft[]>(
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

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: desc.trim() || (isEdit ? null : undefined),
        color: color || (isEdit ? null : undefined),
        values: values
          .filter((v) => v.label.trim() && v.value.trim())
          .map((v, i) => ({
            label: v.label.trim(),
            value: v.value.trim(),
            order: i,
            color: v.color || (isEdit ? null : undefined),
            description: v.description.trim() || (isEdit ? null : undefined),
          })),
      }
      if (template) {
        return api.patch(
          ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(template.id),
          payload,
        )
      }
      return api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, {
        ...(payload as CreateEstimateTemplateInput),
        organizationId: orgId,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Template updated' : 'Template created')
      onSuccess()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save template'),
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
          <DialogTitle>
            {isEdit ? 'Edit Estimate Template' : 'New Estimate Template'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the template values and settings.'
              : 'Define a custom voting scale for estimation sessions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint Estimation"
              maxCharacters={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="min-h-16 resize-none"
              placeholder="When to use this template"
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
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Label = displayed. Value = stored in votes (use numbers for
              stats).
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
                      maxCharacters={20}
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
                      maxCharacters={20}
                      onChange={(e) =>
                        setValues((vals) =>
                          vals.map((vv, j) =>
                            j === i ? { ...vv, value: e.target.value } : vv,
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
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending
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
