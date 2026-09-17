import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import { BulkMutationError, runBulkMutation } from './bulk-mutation'

interface BulkOrgTeamMutationOptions {
  selectedUserIds: string[]
  bulkTargetOrgId: string
  bulkTargetTeamId: string
  onBulkAddOrgSuccess?: () => void
  onBulkAddTeamSuccess?: () => void
}

/**
 * Hook for bulk add to organization and team mutations
 */
export function useBulkOrgTeamMutations({
  selectedUserIds,
  bulkTargetOrgId,
  bulkTargetTeamId,
  onBulkAddOrgSuccess,
  onBulkAddTeamSuccess,
}: BulkOrgTeamMutationOptions) {
  const queryClient = useQueryClient()

  const invalidateMembershipQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] }),
      queryClient.invalidateQueries({
        queryKey: ['organization', bulkTargetOrgId],
      }),
      queryClient.invalidateQueries({ queryKey: ['organizations'] }),
      queryClient.invalidateQueries({ queryKey: ['teams'] }),
      queryClient.invalidateQueries({ queryKey: ['team', bulkTargetTeamId] }),
      queryClient.invalidateQueries({
        queryKey: ['team-members', bulkTargetTeamId],
      }),
    ])

  const bulkAddToOrgMutation = useMutation({
    mutationFn: () =>
      runBulkMutation(
        selectedUserIds.map(
          (userId) => () =>
            api.post(ORGANIZATIONS_ENDPOINTS.MEMBERS(bulkTargetOrgId), {
              userId,
              role: 'member',
            }),
        ),
      ),
    onSuccess: ({ succeeded }) => {
      toast.success(`${succeeded} user(s) added to organisation`)
      onBulkAddOrgSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof BulkMutationError
          ? `Organisation update incomplete: ${error.message}`
          : error.message || 'Failed to add users to organisation',
      )
    },
    onSettled: invalidateMembershipQueries,
  })

  const bulkAddToTeamMutation = useMutation({
    mutationFn: () =>
      runBulkMutation(
        selectedUserIds.map(
          (userId) => () =>
            api.post(TEAMS_ENDPOINTS.MEMBERS(bulkTargetTeamId), {
              userId,
              tag: 'member',
            }),
        ),
      ),
    onSuccess: ({ succeeded }) => {
      toast.success(`${succeeded} user(s) added to team`)
      onBulkAddTeamSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof BulkMutationError
          ? `Team update incomplete: ${error.message}`
          : error.message || 'Failed to add users to team',
      )
    },
    onSettled: invalidateMembershipQueries,
  })

  return { bulkAddToOrgMutation, bulkAddToTeamMutation }
}
