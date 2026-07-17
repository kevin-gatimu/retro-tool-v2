import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { TeamRoleSelection } from '../types'

interface TeamMutationsOptions {
  teamId: string
  organizationId: string
  pendingRequestId: string | null
  selectedMemberIds: string[]
  editName: string
  editDescription: string
  editEmoji: string
  joinRequestMessage: string
  onUpdateSuccess?: () => void
  onAddMemberSuccess?: () => void
  onInviteSuccess?: () => void
  onRemoveMemberSuccess?: () => void
  onRequestToJoinSuccess?: () => void
  onCancelRequestSuccess?: () => void
  onBulkRemoveSuccess?: () => void
  onBulkApproveSuccess?: () => void
}

/**
 * All team-detail mutations. The route owns form/dialog state and passes the
 * current values plus success callbacks; this hook owns the API calls,
 * toast-on-error, cache invalidation, and navigation.
 */
export function useTeamMutations({
  teamId,
  organizationId,
  pendingRequestId,
  selectedMemberIds,
  editName,
  editDescription,
  editEmoji,
  joinRequestMessage,
  onUpdateSuccess,
  onAddMemberSuccess,
  onInviteSuccess,
  onRemoveMemberSuccess,
  onRequestToJoinSuccess,
  onCancelRequestSuccess,
  onBulkRemoveSuccess,
  onBulkApproveSuccess,
}: TeamMutationsOptions) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

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

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(TEAMS_ENDPOINTS.BY_ID(teamId), {
        name: editName,
        description: editDescription || undefined,
        emoji: editEmoji,
      }),
    onSuccess: async () => {
      toast.success('Team updated successfully')
      onUpdateSuccess?.()
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
        queryKey: ['org-teams', organizationId],
      })
      navigate({
        to: '/organizations/$orgId',
        params: { orgId: organizationId },
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
        params: { orgId: organizationId },
      })
    },
    onError: (error) => toast.error(error.message || 'Failed to leave team'),
  })

  const addMemberMutation = useMutation({
    mutationFn: async (variables: {
      userIds: string[]
      role: TeamRoleSelection
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
      onAddMemberSuccess?.()
      await invalidateTeam()
    },
    onError: (error) => toast.error(error.message || 'Failed to add member'),
  })

  const inviteMemberMutation = useMutation({
    mutationFn: ({ email, tag }: { email: string; tag: TeamRoleSelection }) =>
      api.post(TEAMS_ENDPOINTS.INVITE(teamId), { email, tag }),
    onSuccess: (_, variables) => {
      toast.success(`Invitation sent to ${variables.email}`)
      onInviteSuccess?.()
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to send invitation'),
  })

  const updateHierarchyMutation = useMutation({
    mutationFn: ({ userId, tag }: { userId: string; tag: TeamRoleSelection }) =>
      api.patch(TEAMS_ENDPOINTS.MEMBER_BY_ID(teamId, userId), { tag }),
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
      onRemoveMemberSuccess?.()
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
      onRequestToJoinSuccess?.()
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
      onCancelRequestSuccess?.()
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
      onBulkRemoveSuccess?.()
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
      onBulkApproveSuccess?.()
      await invalidateTeam()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to bulk approve requests'),
  })

  return {
    updateMutation,
    deleteMutation,
    joinMutation,
    leaveMutation,
    addMemberMutation,
    inviteMemberMutation,
    updateHierarchyMutation,
    updateJobRoleMutation,
    removeMemberMutation,
    requestToJoinMutation,
    cancelRequestMutation,
    approveRequestMutation,
    rejectRequestMutation,
    bulkRemoveMembersMutation,
    bulkApproveRequestsMutation,
  }
}
