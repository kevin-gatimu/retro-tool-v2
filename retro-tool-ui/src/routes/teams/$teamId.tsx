import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getJoinRequestColumns,
  getTeamMemberColumns,
} from '@/components/tables/member-columns'
import type {
  JoinRequestRow,
  TeamMemberRow,
  OrgTeamRole,
} from '@/components/tables/member-columns'
import { getTeamInvitationColumns } from '@/components/tables/invitation-columns'
import type { TeamInvitationRow } from '@/components/tables/invitation-columns'
import { UserAvatar } from '@/components/user-avatar'
import { getTeamRoleBadge } from '@/components/user-role-badges'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEAM_ROLES_ENDPOINTS,
  TEAMS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'

import type { TeamDetail, TeamMember } from '@/common/types/teams'
import type { Organization } from '@/common/types/organizations'
import type { User } from '@/common/types/users'
import { TeamDetailSkeleton } from './skeleton'

export const Route = createFileRoute('/teams/$teamId')({
  loader: ({ context: { queryClient }, params: { teamId } }) =>
    void queryClient.prefetchQuery({
      queryKey: ['team', teamId] as const,
      queryFn: () => api.get<TeamDetail>(TEAMS_ENDPOINTS.BY_ID(teamId)),
    }),
  pendingComponent: TeamDetailSkeleton,
  component: TeamDetailPage,
})

function TeamDetailPage() {
  const { teamId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: team } = useSuspenseQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.get<TeamDetail>(TEAMS_ENDPOINTS.BY_ID(teamId)),
  })

  const { data: organization } = useQuery({
    queryKey: ['organization', team.organizationId],
    queryFn: () =>
      api.get<Organization>(ORGANIZATIONS_ENDPOINTS.BY_ID(team.organizationId)),
    enabled: !!team.organizationId,
  })

  const invalidateTeam = async () => {
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: ['team', teamId],
        type: 'active',
      }),
      queryClient.refetchQueries({
        queryKey: ['team-members', teamId],
        type: 'active',
      }),
    ])
  }

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)
  const [memberRowSelection, setMemberRowSelection] = useState<
    Record<string, boolean>
  >({})
  const selectedMemberIds = Object.keys(memberRowSelection).filter(
    (id) => memberRowSelection[id],
  )
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [isRequestJoinOpen, setIsRequestJoinOpen] = useState(false)
  const [cancelRequestConfirmOpen, setCancelRequestConfirmOpen] =
    useState(false)
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([])

  // Form states
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editEmoji, setEditEmoji] = useState('👥')
  const [addMemberUserIds, setAddMemberUserIds] = useState<string[]>([])
  const [addMemberRole, setAddMemberRole] = useState<'team-lead' | 'member'>(
    'member',
  )
  const [joinRequestMessage, setJoinRequestMessage] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteTag, setInviteTag] = useState<'team-lead' | 'member'>('member')
  const [inviteEmailCheck, setInviteEmailCheck] = useState<{
    registered: boolean
    name?: string
    isMember?: boolean
  } | null>(null)

  // Sync edit form when team loads
  useEffect(() => {
    setEditName(team.name)
    setEditDescription(team.description ?? '')
    setEditEmoji(team.emoji ?? '👥')
  }, [team])

  const isOrgAdmin =
    team.orgRole === 'org-owner' || team.orgRole === 'org-admin'
  const isTeamLead = team.myRole === 'team-lead'
  const canManage = isOrgAdmin || isTeamLead || team.isSystemAdmin
  const isMember = team.isMember || team.myRole === 'member'
  const canSeeMembers = team.canSeeMembers || isMember || canManage
  const teamMembers: TeamMember[] = Array.isArray(team.members)
    ? team.members
    : []
  const joinRequests = Array.isArray(team.joinRequests) ? team.joinRequests : []
  const orgMembers = Array.isArray(organization?.members)
    ? organization.members
    : []
  const orgName = team.organization.name
  const pendingRequestId = team.myPendingRequestId

  const teamMembersQuery = useQuery({
    queryKey: ['team-members', teamId, memberPage, memberPageSize],
    queryFn: () =>
      api.get<{
        members: TeamMemberRow[]
        total: number
        page: number
        totalPages: number
      }>(
        `${TEAMS_ENDPOINTS.MEMBERS(teamId)}?page=${memberPage}&limit=${memberPageSize}`,
      ),
    enabled: canSeeMembers,
    placeholderData: (prev) => prev,
  })

  const orgRolesQuery = useQuery({
    queryKey: ['org-team-roles', team.organizationId],
    queryFn: () =>
      api.get<OrgTeamRole[]>(
        TEAM_ROLES_ENDPOINTS.ORG_LIST(team.organizationId),
      ),
    enabled: !!team.organizationId,
  })
  const orgRoles = Array.isArray(orgRolesQuery.data) ? orgRolesQuery.data : []

  const pagedMembers = teamMembersQuery.data?.members ?? []
  const totalMembersCount =
    teamMembersQuery.data?.total ?? team.memberCount ?? 0
  const totalMemberPages = teamMembersQuery.data?.totalPages ?? 1

  const availableMembers = orgMembers.filter(
    (om) => !teamMembers.some((tm) => tm.userId === om.userId),
  )

  const orgMemberIds = new Set(orgMembers.map((om) => om.userId))
  const filteredSearchResults = searchResults.filter(
    (u) =>
      orgMemberIds.has(u.id) && !teamMembers.some((tm) => tm.userId === u.id),
  )

  const displayedMemberCount = totalMembersCount

  const toggleAddMemberSelection = (userId: string) => {
    setAddMemberUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    )
  }

  // Search for users when search term changes
  useEffect(() => {
    if (memberSearch.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await api.get<User[]>(
          `${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(memberSearch)}`,
        )
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [memberSearch])

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(TEAMS_ENDPOINTS.BY_ID(teamId), {
        name: editName,
        description: editDescription || undefined,
        emoji: editEmoji,
      }),
    onSuccess: async () => {
      toast.success('Team updated successfully')
      setIsEditOpen(false)
      await invalidateTeam()
    },
    onError: (error) => toast.error(error.message || 'Failed to update team'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(TEAMS_ENDPOINTS.BY_ID(teamId)),
    onSuccess: () => {
      toast.success('Team deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({
        queryKey: ['org-teams', team.organizationId],
      })
      navigate({
        to: '/organizations/$orgId',
        params: { orgId: team.organizationId },
      })
    },
    onError: (error) => toast.error(error.message || 'Failed to delete team'),
  })

  const joinMutation = useMutation({
    mutationFn: () => api.post(TEAMS_ENDPOINTS.JOIN(teamId)),
    onSuccess: async () => {
      toast.success('You have joined the team')
      await invalidateTeam()
    },
    onError: (error) => toast.error(error.message || 'Failed to join team'),
  })

  const leaveMutation = useMutation({
    mutationFn: () => api.post(TEAMS_ENDPOINTS.LEAVE(teamId)),
    onSuccess: () => {
      toast.success('You have left the team')
      navigate({
        to: '/organizations/$orgId',
        params: { orgId: team.organizationId },
      })
    },
    onError: (error) => toast.error(error.message || 'Failed to leave team'),
  })

  const addMemberMutation = useMutation({
    mutationFn: async (variables: {
      userIds: string[]
      role: 'team-lead' | 'member'
    }) => {
      for (const userId of variables.userIds) {
        await api.post(TEAMS_ENDPOINTS.MEMBERS(teamId), {
          userId,
          tag: variables.role,
        })
      }
    },
    onSuccess: async (_, variables) => {
      const roleLabel = variables.role === 'team-lead' ? 'Team Lead' : 'Member'
      toast.success(
        `${variables.userIds.length} member(s) added as ${roleLabel}`,
      )
      setIsAddMemberOpen(false)
      setAddMemberUserIds([])
      setAddMemberRole('member')
      setMemberSearch('')
      setSearchResults([])
      await invalidateTeam()
    },
    onError: (error) => toast.error(error.message || 'Failed to add member'),
  })

  const inviteMemberMutation = useMutation({
    mutationFn: ({
      email,
      tag,
    }: {
      email: string
      tag: 'team-lead' | 'member'
    }) => api.post(TEAMS_ENDPOINTS.INVITE(teamId), { email, tag }),
    onSuccess: (_, variables) => {
      toast.success(`Invitation sent to ${variables.email}`)
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteTag('member')
      setInviteEmailCheck(null)
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to send invitation'),
  })

  const updateHierarchyMutation = useMutation({
    mutationFn: ({
      userId,
      tag,
    }: {
      userId: string
      tag: 'team-lead' | 'member'
    }) => api.patch(TEAMS_ENDPOINTS.MEMBER_BY_ID(teamId, userId), { tag }),
    onSuccess: async () => {
      toast.success('Member hierarchy updated')
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to update hierarchy'),
  })

  const updateJobRoleMutation = useMutation({
    mutationFn: ({
      userId,
      roleId,
    }: {
      userId: string
      roleId: string | null
    }) =>
      api.patch(TEAMS_ENDPOINTS.MEMBER_JOB_ROLE(teamId, userId), { roleId }),
    onSuccess: async () => {
      toast.success('Member job role updated')
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to update job role'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(TEAMS_ENDPOINTS.MEMBER_BY_ID(teamId, userId)),
    onSuccess: async () => {
      toast.success('Member removed from team')
      setRemoveMemberId(null)
      await invalidateTeam()
    },
    onError: (error) => toast.error(error.message || 'Failed to remove member'),
  })

  const requestToJoinMutation = useMutation({
    mutationFn: () =>
      api.post(TEAMS_ENDPOINTS.JOIN_REQUESTS(teamId), {
        message: joinRequestMessage || undefined,
      }),
    onSuccess: async () => {
      toast.success('Join request sent successfully')
      setIsRequestJoinOpen(false)
      setJoinRequestMessage('')
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to send join request'),
  })

  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      if (!pendingRequestId) throw new Error('No pending request to cancel')
      return api.delete(
        TEAMS_ENDPOINTS.JOIN_REQUEST_BY_ID(teamId, pendingRequestId),
      )
    },
    onSuccess: async () => {
      toast.success('Join request cancelled')
      setCancelRequestConfirmOpen(false)
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to cancel request'),
  })

  const approveRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.post(TEAMS_ENDPOINTS.JOIN_REQUEST_APPROVE(teamId, requestId)),
    onSuccess: async () => {
      toast.success('Join request approved')
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to approve request'),
  })

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.post(TEAMS_ENDPOINTS.JOIN_REQUEST_REJECT(teamId, requestId)),
    onSuccess: async () => {
      toast.success('Join request rejected')
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to reject request'),
  })

  const bulkRemoveMembersMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedMemberIds.map((userId) =>
          api.delete(TEAMS_ENDPOINTS.MEMBER_BY_ID(teamId, userId)),
        ),
      ),
    onSuccess: async () => {
      toast.success(`${selectedMemberIds.length} member(s) removed`)
      setMemberRowSelection({})
      await invalidateTeam()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to remove members'),
  })

  const bulkApproveRequestsMutation = useMutation({
    mutationFn: (requestIds: string[]) =>
      api.post<{ approved: number; failed: number }>(
        TEAMS_ENDPOINTS.JOIN_REQUESTS_BULK_APPROVE(teamId),
        { requestIds },
      ),
    onSuccess: async (result) => {
      toast.success(`Approved ${result.approved} request(s)`)
      setSelectedRequestIds([])
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to bulk approve requests'),
  })

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/organizations/$orgId"
          params={{ orgId: team.organizationId }}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to {orgName}
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{team.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {team.name}
                </h1>
                {getTeamRoleBadge(
                  team.myRole,
                  team.orgRole,
                  team.isSystemAdmin ? 'system-admin' : undefined,
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{orgName}</span>
              </div>
              {team.description && (
                <p className="mt-2 text-muted-foreground">{team.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isMember && !team.hasPendingRequest && isOrgAdmin && (
              <Button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Join Team
              </Button>
            )}
            {!isMember && !team.hasPendingRequest && !isOrgAdmin && (
              <Button onClick={() => setIsRequestJoinOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Request to Join
              </Button>
            )}
            {!isMember && team.hasPendingRequest && (
              <Button
                variant="outline"
                onClick={() => setCancelRequestConfirmOpen(true)}
              >
                <Clock className="mr-2 h-4 w-4" />
                Request Pending
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && (
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Team
                  </DropdownMenuItem>
                )}
                {isMember && (
                  <DropdownMenuItem
                    onClick={() => setLeaveConfirmOpen(true)}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave Team
                  </DropdownMenuItem>
                )}
                {isOrgAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Team
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Members ({displayedMemberCount})
          </h2>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                {/* Invite by Email */}
                <Dialog
                  open={isInviteOpen}
                  onOpenChange={(open) => {
                    setIsInviteOpen(open)
                    if (!open) {
                      setInviteEmail('')
                      setInviteTag('member')
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
                      <DialogTitle>Invite Team Member by Email</DialogTitle>
                      <DialogDescription>
                        Send an invitation email. The invitee will also be added
                        to this team's organisation.
                      </DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (inviteEmail && !inviteMemberMutation.isPending)
                          inviteMemberMutation.mutate({
                            email: inviteEmail,
                            tag: inviteTag,
                          })
                      }}
                    >
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="team-invite-email">Email</Label>
                          <Input
                            id="team-invite-email"
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
                                  isMember?: boolean
                                }>(
                                  `${TEAMS_ENDPOINTS.CHECK_INVITE_EMAIL(teamId)}?email=${encodeURIComponent(inviteEmail)}`,
                                )
                                setInviteEmailCheck(result)
                              } catch {
                                setInviteEmailCheck(null)
                              }
                            }}
                          />
                          {inviteEmailCheck !== null && (
                            <p
                              className={`text-xs ${inviteEmailCheck.isMember ? 'text-destructive' : inviteEmailCheck.registered ? 'text-emerald-400' : 'text-gray-400'}`}
                            >
                              {inviteEmailCheck.isMember
                                ? 'This user is already a member of this team'
                                : inviteEmailCheck.registered
                                  ? `Account found${inviteEmailCheck.name ? ` (${inviteEmailCheck.name})` : ''} — invitation email will be sent`
                                  : 'No account found — invitation email will be sent to register'}
                            </p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label>Team Rank</Label>
                          <Select
                            value={inviteTag}
                            onValueChange={(v: string) =>
                              setInviteTag(v as 'team-lead' | 'member')
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="team-lead">
                                Team Lead
                              </SelectItem>
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
                            !inviteEmail ||
                            inviteMemberMutation.isPending ||
                            !!inviteEmailCheck?.isMember
                          }
                        >
                          {inviteMemberMutation.isPending
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
                      setMemberSearch('')
                      setSearchResults([])
                      setAddMemberUserIds([])
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
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>
                        Select one or more users to add to this team. Team Rank
                        will be applied to all selected users.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="memberSearch">Search User</Label>
                        <Input
                          id="memberSearch"
                          placeholder="Type name or email to search..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                        />
                        {isSearching && (
                          <p className="text-sm text-muted-foreground">
                            Searching...
                          </p>
                        )}
                      </div>

                      {/* Quick add from org members */}
                      {memberSearch.length < 2 &&
                        availableMembers.length > 0 && (
                          <div className="grid gap-2">
                            <Label>Organization Members</Label>
                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                              {availableMembers.map((om) => (
                                <div
                                  key={om.userId}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                                    addMemberUserIds.includes(om.userId)
                                      ? 'bg-muted'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    toggleAddMemberSelection(om.userId)
                                  }
                                >
                                  <UserAvatar
                                    image={om.user.image}
                                    name={om.user.name}
                                    userId={om.userId}
                                    size="sm"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {om.user.name ?? om.user.email}
                                    </p>
                                    {om.user.name && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {om.user.email}
                                      </p>
                                    )}
                                  </div>
                                  {addMemberUserIds.includes(om.userId) && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Search results */}
                      {memberSearch.length >= 2 &&
                        filteredSearchResults.length > 0 && (
                          <div className="grid gap-2">
                            <Label>Search Results</Label>
                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                              {filteredSearchResults.map((u) => (
                                <div
                                  key={u.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                                    addMemberUserIds.includes(u.id)
                                      ? 'bg-muted'
                                      : ''
                                  }`}
                                  onClick={() => toggleAddMemberSelection(u.id)}
                                >
                                  <UserAvatar
                                    image={u.image}
                                    name={u.name}
                                    userId={u.id}
                                    size="sm"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {u.name}
                                    </p>
                                    {u.name && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {u.email}
                                      </p>
                                    )}
                                  </div>
                                  {addMemberUserIds.includes(u.id) && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {memberSearch.length >= 2 &&
                        !isSearching &&
                        filteredSearchResults.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No users found matching "{memberSearch}"
                          </p>
                        )}

                      <div className="grid gap-2">
                        <Label htmlFor="role">Team Rank</Label>
                        <Select
                          value={addMemberRole}
                          onValueChange={(v: string) =>
                            setAddMemberRole(v as 'team-lead' | 'member')
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="team-lead">Team Lead</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {addMemberUserIds.length} user(s) selected with rank:{' '}
                        {addMemberRole === 'team-lead' ? 'Team Lead' : 'Member'}
                      </p>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddMemberOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          addMemberMutation.mutate({
                            userIds: addMemberUserIds,
                            role: addMemberRole,
                          })
                        }
                        disabled={
                          addMemberUserIds.length === 0 ||
                          addMemberMutation.isPending
                        }
                      >
                        {addMemberMutation.isPending
                          ? 'Adding...'
                          : `Add ${addMemberUserIds.length || ''}${
                              addMemberUserIds.length ? ' Member(s)' : ''
                            }`}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {!canSeeMembers ? null : teamMembersQuery.data?.total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No members yet</h3>
              <p className="mb-4 text-center text-muted-foreground">
                Be the first to join this team!
              </p>
              {!isMember && !team.hasPendingRequest && isOrgAdmin && (
                <Button onClick={() => joinMutation.mutate()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Join Team
                </Button>
              )}
              {!isMember && !team.hasPendingRequest && !isOrgAdmin && (
                <Button onClick={() => setIsRequestJoinOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Request to Join
                </Button>
              )}
              {!isMember && team.hasPendingRequest && (
                <Button
                  variant="outline"
                  onClick={() => setCancelRequestConfirmOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Request Pending
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="relative">
              {teamMembersQuery.isFetching && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <DataTable
                columns={getTeamMemberColumns({
                  canManage: !!canManage,
                  orgRoles,
                  onUpdateHierarchy: (userId, tag) =>
                    updateHierarchyMutation.mutate({ userId, tag }),
                  onRemove: (userId) => setRemoveMemberId(userId),
                  onUpdateJobRole: (userId, roleId) =>
                    updateJobRoleMutation.mutate({ userId, roleId }),
                })}
                data={pagedMembers}
                searchColumn="user"
                searchPlaceholder="Search members..."
                pagination={false}
                selectable={canManage}
                rowSelection={memberRowSelection}
                onRowSelectionChange={setMemberRowSelection}
                getRowId={(row) => row.userId}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {totalMembersCount} row(s) total.
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Rows per page
                  </span>
                  <Select
                    value={String(memberPageSize)}
                    onValueChange={(value) => {
                      setMemberPageSize(Number(value))
                      setMemberPage(1)
                      setMemberRowSelection({})
                    }}
                  >
                    <SelectTrigger className="h-8 w-17.5">
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
                  Page {memberPage} of {totalMemberPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setMemberPage((prev) => Math.max(1, prev - 1))
                    setMemberRowSelection({})
                  }}
                  disabled={memberPage <= 1 || teamMembersQuery.isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setMemberPage((prev) =>
                      Math.min(totalMemberPages, prev + 1),
                    )
                    setMemberRowSelection({})
                  }}
                  disabled={
                    memberPage >= totalMemberPages ||
                    teamMembersQuery.isFetching
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => teamMembersQuery.refetch()}
                  disabled={teamMembersQuery.isFetching}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${teamMembersQuery.isFetching ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
            {canManage && selectedMemberIds.length > 0 && (
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
          </>
        )}
      </div>

      {/* Pending Join Requests */}
      {canManage && joinRequests.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Pending Requests ({joinRequests.length})
            </h2>
            {selectedRequestIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedRequestIds.length} selected
                </span>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() =>
                    bulkApproveRequestsMutation.mutate(selectedRequestIds)
                  }
                  disabled={bulkApproveRequestsMutation.isPending}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Approve Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedRequestIds([])}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
          <DataTable
            columns={getJoinRequestColumns({
              onApprove: (requestId) =>
                approveRequestMutation.mutate(requestId),
              onReject: (requestId) => rejectRequestMutation.mutate(requestId),
              isApproving: approveRequestMutation.isPending,
              isRejecting: rejectRequestMutation.isPending,
            })}
            data={joinRequests as JoinRequestRow[]}
            getRowId={(row) => row.id}
            searchColumn="user"
            searchPlaceholder="Search requests..."
            defaultPageSize={5}
            rowSelection={Object.fromEntries(
              selectedRequestIds.map((id) => [id, true]),
            )}
            onRowSelectionChange={(selection) =>
              setSelectedRequestIds(
                Object.entries(selection)
                  .filter(([, v]) => v)
                  .map(([id]) => id),
              )
            }
          />
        </div>
      )}

      {canManage && <TeamInvitationsSection teamId={teamId} />}

      {/* Edit Team Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update your team details.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (editName && !updateMutation.isPending) updateMutation.mutate()
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editEmoji">Emoji</Label>
                <Input
                  id="editEmoji"
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  className="w-20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editDescription">Description</Label>
                <Textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
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
                disabled={!editName || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{team.name}". This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Team Confirm */}
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Team?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be a member of "{team.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveMutation.mutate()}>
              Leave
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
              This member will be removed from the team.
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

      {/* Request to Join Dialog */}
      <Dialog open={isRequestJoinOpen} onOpenChange={setIsRequestJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join Team</DialogTitle>
            <DialogDescription>
              Your request will be sent to the team leads and organization
              admins for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="joinMessage">Message (optional)</Label>
              <Textarea
                id="joinMessage"
                placeholder="Tell us why you'd like to join this team..."
                value={joinRequestMessage}
                onChange={(e) => setJoinRequestMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRequestJoinOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => requestToJoinMutation.mutate()}
              disabled={requestToJoinMutation.isPending}
            >
              {requestToJoinMutation.isPending ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Request Confirm */}
      <AlertDialog
        open={cancelRequestConfirmOpen}
        onOpenChange={setCancelRequestConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Join Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Your pending request to join "{team.name}" will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelRequestMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================================
// Team Invitations Section
// ============================================================================

function TeamInvitationsSection({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const invitationsQuery = useQuery({
    queryKey: ['team-invitations', teamId, page, pageSize],
    queryFn: () =>
      api.get<{
        invitations: TeamInvitationRow[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(
        `${TEAMS_ENDPOINTS.INVITATIONS(teamId)}?page=${page}&limit=${pageSize}`,
      ),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(TEAMS_ENDPOINTS.REVOKE_INVITATION(teamId, invitationId)),
    onSuccess: () => {
      toast.success('Invitation revoked')
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.post(TEAMS_ENDPOINTS.RESEND_INVITATION(teamId, invitationId)),
    onSuccess: () => {
      toast.success('Invitation resent')
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const data = invitationsQuery.data

  if (!data || (data.total === 0 && !invitationsQuery.isFetching)) return null

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Mail className="h-5 w-5" />
        Pending Invitations ({data.total})
      </h2>
      <DataTable
        columns={getTeamInvitationColumns({
          onResend: (id) => resendMutation.mutate(id),
          onRevoke: (id) => revokeMutation.mutate(id),
        })}
        data={data.invitations}
        searchColumn="email"
        searchPlaceholder="Search invitations by email..."
        manualPagination
        pageCount={data.totalPages}
        rowCount={data.total}
        paginationState={{ pageIndex: page - 1, pageSize }}
        onPaginationChange={(p) => {
          setPage(p.pageIndex + 1)
          setPageSize(p.pageSize)
        }}
        isFetching={invitationsQuery.isFetching}
        onRefresh={() => invitationsQuery.refetch()}
        defaultPageSize={10}
      />
    </div>
  )
}
