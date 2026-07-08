import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TEAM_ROLES_ENDPOINTS } from '@/lib/api-endpoints'

export function useAdminTeamRoleMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-team-roles'] })

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string
      sortOrder?: number
      isActive?: boolean
    }) => api.post(TEAM_ROLES_ENDPOINTS.LIST, payload),
    onSuccess: () => {
      toast.success('Team role created')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create role')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { name?: string; sortOrder?: number; isActive?: boolean }
    }) => api.patch(TEAM_ROLES_ENDPOINTS.BY_ID(id), payload),
    onSuccess: () => {
      toast.success('Team role updated')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(TEAM_ROLES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Team role deleted')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete role')
    },
  })

  const seedMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string; added: number }>(
        TEAM_ROLES_ENDPOINTS.SEED,
        {},
      ),
    onSuccess: (data) => {
      toast.success(data.message)
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to seed roles')
    },
  })

  return { createMutation, updateMutation, deleteMutation, seedMutation }
}
