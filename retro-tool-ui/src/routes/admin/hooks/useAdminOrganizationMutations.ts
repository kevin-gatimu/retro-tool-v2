import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Organization } from '@/common/types/organizations'

export function useAdminOrganizationMutations({
  onCreateSuccess,
  onUpdateSuccess,
  onDeleteSuccess,
}: {
  onCreateSuccess?: () => void
  onUpdateSuccess?: () => void
  onDeleteSuccess?: () => void
} = {}) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-organizations'] })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      api.post(ORGANIZATIONS_ENDPOINTS.LIST, data),
    onSuccess: () => {
      toast.success('Organization created')
      onCreateSuccess?.()
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create organization')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; slug: string }) =>
      api.patch(ORGANIZATIONS_ENDPOINTS.BY_ID(data.id), {
        name: data.name,
        slug: data.slug,
      }),
    onSuccess: (_, variables) => {
      toast.success('Organization updated')
      queryClient.setQueryData<Organization[]>(
        ['sidebar-organizations'],
        (previous = []) =>
          previous.map((org) =>
            org.id === variables.id
              ? { ...org, name: variables.name, slug: variables.slug }
              : org,
          ),
      )
      onUpdateSuccess?.()
      void invalidate()
      void queryClient.invalidateQueries({
        queryKey: ['sidebar-organizations'],
      })
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update organization')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (organizationId: string) =>
      api.delete(ORGANIZATIONS_ENDPOINTS.BY_ID(organizationId)),
    onSuccess: (_data, organizationId) => {
      toast.success('Organization deleted')
      queryClient.setQueryData<Organization[]>(
        ['sidebar-organizations'],
        (previous = []) =>
          previous.filter((organization) => organization.id !== organizationId),
      )
      onDeleteSuccess?.()
      void invalidate()
      void queryClient.invalidateQueries({
        queryKey: ['sidebar-organizations'],
      })
      void queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete organization')
    },
  })

  return { createMutation, updateMutation, deleteMutation }
}
