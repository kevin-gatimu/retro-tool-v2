import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'

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
  const bulkAddToOrgMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedUserIds.map((userId) =>
          api.post(ORGANIZATIONS_ENDPOINTS.MEMBERS(bulkTargetOrgId), {
            userId,
            role: 'member',
          }),
        ),
      ),
    onSuccess: () => {
      toast.success(`${selectedUserIds.length} user(s) added to organisation`)
      onBulkAddOrgSuccess?.()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to add to organisation'),
  })

  const bulkAddToTeamMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedUserIds.map((userId) =>
          api.post(TEAMS_ENDPOINTS.MEMBERS(bulkTargetTeamId), {
            userId,
            tag: 'member',
          }),
        ),
      ),
    onSuccess: () => {
      toast.success(`${selectedUserIds.length} user(s) added to team`)
      onBulkAddTeamSuccess?.()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add to team'),
  })

  return { bulkAddToOrgMutation, bulkAddToTeamMutation }
}
