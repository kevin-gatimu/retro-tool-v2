import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TEAM_ROLES_ENDPOINTS } from '@/lib/api-endpoints'

export function useOrgTeamRoleMutations(orgId: string) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['org-team-roles', orgId] })

  const createCustomRoleMutation = useMutation({
    mutationFn: (payload: { name: string; sortOrder?: number }) =>
      api.post(TEAM_ROLES_ENDPOINTS.ORG_LIST(orgId), payload),
    onSuccess: () => {
      toast.success('Custom role created')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create role')
    },
  })

  const updateCustomRoleMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { name?: string; sortOrder?: number; isActive?: boolean }
    }) => api.patch(TEAM_ROLES_ENDPOINTS.ORG_BY_ID(orgId, id), payload),
    onSuccess: () => {
      toast.success('Role updated')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role')
    },
  })

  const deleteCustomRoleMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(TEAM_ROLES_ENDPOINTS.ORG_BY_ID(orgId, id)),
    onSuccess: () => {
      toast.success('Role deleted')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete role')
    },
  })

  const toggleActivationMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(TEAM_ROLES_ENDPOINTS.ORG_ACTIVATION(orgId, id), { isActive }),
    onSuccess: () => {
      toast.success('Role availability updated')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role')
    },
  })

  return {
    createCustomRoleMutation,
    updateCustomRoleMutation,
    deleteCustomRoleMutation,
    toggleActivationMutation,
  }
}
