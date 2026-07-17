import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { TeamDetail, TeamMember } from '@/common/types/teams'
import { useUserSearch } from './hooks/use-user-search'
import {
  useOrgTeamRoles,
  useTeamDetail,
  useTeamMembers,
  useTeamMutations,
  useTeamOrganization,
} from './hooks'
import { TeamDetailSkeleton } from './skeleton'
import type { InviteEmailCheckState, TeamRoleSelection } from './types'
import {
  CancelRequestDialog,
  DeleteTeamDialog,
  EditTeamDialog,
  JoinRequestsSection,
  LeaveTeamDialog,
  RemoveMemberDialog,
  RequestToJoinDialog,
  TeamHeader,
  TeamInvitationsSection,
  TeamMembersSection,
} from './components'

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

  const { data: team } = useTeamDetail(teamId)
  const { data: organization } = useTeamOrganization(team.organizationId)

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
  const [addMemberRole, setAddMemberRole] =
    useState<TeamRoleSelection>('member')
  const [joinRequestMessage, setJoinRequestMessage] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const { results: searchResults, isSearching } = useUserSearch(memberSearch)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteTag, setInviteTag] = useState<TeamRoleSelection>('member')
  const [inviteEmailCheck, setInviteEmailCheck] =
    useState<InviteEmailCheckState>(null)

  // Seed the edit form from the current team, then open the dialog. Called on
  // "Edit" click instead of mirroring `team` into state on every change.
  const openEditDialog = () => {
    setEditName(team.name)
    setEditDescription(team.description ?? '')
    setEditEmoji(team.emoji ?? '👥')
    setIsEditOpen(true)
  }

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

  const teamMembersQuery = useTeamMembers({
    teamId,
    page: memberPage,
    pageSize: memberPageSize,
    enabled: canSeeMembers,
  })

  const orgRolesQuery = useOrgTeamRoles(team.organizationId)
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

  const mutations = useTeamMutations({
    teamId,
    organizationId: team.organizationId,
    pendingRequestId,
    selectedMemberIds,
    editName,
    editDescription,
    editEmoji,
    joinRequestMessage,
    onUpdateSuccess: () => setIsEditOpen(false),
    onAddMemberSuccess: () => {
      setIsAddMemberOpen(false)
      setAddMemberUserIds([])
      setAddMemberRole('member')
      setMemberSearch('')
    },
    onInviteSuccess: () => {
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteTag('member')
      setInviteEmailCheck(null)
    },
    onRemoveMemberSuccess: () => setRemoveMemberId(null),
    onRequestToJoinSuccess: () => {
      setIsRequestJoinOpen(false)
      setJoinRequestMessage('')
    },
    onCancelRequestSuccess: () => setCancelRequestConfirmOpen(false),
    onBulkRemoveSuccess: () => setMemberRowSelection({}),
    onBulkApproveSuccess: () => setSelectedRequestIds([]),
  })

  return (
    <div className="container py-8">
      <TeamHeader
        team={team}
        orgName={orgName}
        isMember={isMember}
        isOrgAdmin={isOrgAdmin}
        canManage={canManage}
        joinMutation={mutations.joinMutation}
        onEdit={openEditDialog}
        onLeave={() => setLeaveConfirmOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        onRequestToJoin={() => setIsRequestJoinOpen(true)}
        onCancelRequest={() => setCancelRequestConfirmOpen(true)}
      />

      <TeamMembersSection
        teamId={teamId}
        displayedMemberCount={displayedMemberCount}
        canManage={canManage}
        canSeeMembers={canSeeMembers}
        isMember={isMember}
        isOrgAdmin={isOrgAdmin}
        hasPendingRequest={team.hasPendingRequest}
        teamMembersQuery={teamMembersQuery}
        pagedMembers={pagedMembers}
        totalMembersCount={totalMembersCount}
        totalMemberPages={totalMemberPages}
        memberPage={memberPage}
        memberPageSize={memberPageSize}
        onMemberPageChange={setMemberPage}
        onMemberPageSizeChange={(size) => {
          setMemberPageSize(size)
          setMemberPage(1)
          setMemberRowSelection({})
        }}
        orgRoles={orgRoles}
        memberRowSelection={memberRowSelection}
        onMemberRowSelectionChange={setMemberRowSelection}
        selectedMemberIds={selectedMemberIds}
        onClearMemberSelection={() => setMemberRowSelection({})}
        onJoin={() => mutations.joinMutation.mutate()}
        onRequestToJoin={() => setIsRequestJoinOpen(true)}
        onCancelRequest={() => setCancelRequestConfirmOpen(true)}
        onRemoveMember={(userId) => setRemoveMemberId(userId)}
        isInviteOpen={isInviteOpen}
        onInviteOpenChange={setIsInviteOpen}
        inviteEmail={inviteEmail}
        onInviteEmailChange={setInviteEmail}
        inviteTag={inviteTag}
        onInviteTagChange={setInviteTag}
        inviteEmailCheck={inviteEmailCheck}
        onInviteEmailCheckChange={setInviteEmailCheck}
        isAddMemberOpen={isAddMemberOpen}
        onAddMemberOpenChange={setIsAddMemberOpen}
        memberSearch={memberSearch}
        onMemberSearchChange={setMemberSearch}
        isSearching={isSearching}
        availableMembers={availableMembers}
        filteredSearchResults={filteredSearchResults}
        addMemberUserIds={addMemberUserIds}
        onToggleAddMemberSelection={toggleAddMemberSelection}
        onClearAddMemberSelection={() => setAddMemberUserIds([])}
        addMemberRole={addMemberRole}
        onAddMemberRoleChange={setAddMemberRole}
        mutations={mutations}
      />

      {canManage && joinRequests.length > 0 && (
        <JoinRequestsSection
          joinRequests={joinRequests}
          selectedRequestIds={selectedRequestIds}
          onSelectedRequestIdsChange={setSelectedRequestIds}
          approveRequestMutation={mutations.approveRequestMutation}
          rejectRequestMutation={mutations.rejectRequestMutation}
          bulkApproveRequestsMutation={mutations.bulkApproveRequestsMutation}
        />
      )}

      {canManage && <TeamInvitationsSection teamId={teamId} />}

      <EditTeamDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editName={editName}
        onEditNameChange={setEditName}
        editDescription={editDescription}
        onEditDescriptionChange={setEditDescription}
        editEmoji={editEmoji}
        onEditEmojiChange={setEditEmoji}
        updateMutation={mutations.updateMutation}
      />

      <DeleteTeamDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        teamName={team.name}
        deleteMutation={mutations.deleteMutation}
      />

      <LeaveTeamDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        teamName={team.name}
        leaveMutation={mutations.leaveMutation}
      />

      <RemoveMemberDialog
        removeMemberId={removeMemberId}
        onOpenChange={() => setRemoveMemberId(null)}
        removeMemberMutation={mutations.removeMemberMutation}
      />

      <RequestToJoinDialog
        open={isRequestJoinOpen}
        onOpenChange={setIsRequestJoinOpen}
        joinRequestMessage={joinRequestMessage}
        onJoinRequestMessageChange={setJoinRequestMessage}
        requestToJoinMutation={mutations.requestToJoinMutation}
      />

      <CancelRequestDialog
        open={cancelRequestConfirmOpen}
        onOpenChange={setCancelRequestConfirmOpen}
        teamName={team.name}
        cancelRequestMutation={mutations.cancelRequestMutation}
      />
    </div>
  )
}
