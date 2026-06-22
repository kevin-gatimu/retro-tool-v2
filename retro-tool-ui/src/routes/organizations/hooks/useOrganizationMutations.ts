import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from '@/common/types/organizations'
import type { CreateTeamInput } from '@/common/types/teams'

export function useOrganizationMutations() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['organizations'] }),
      queryClient.invalidateQueries({ queryKey: ['sidebar-organizations'] }),
    ])
  }

  const createOrgMutation = useMutation({
    mutationFn: (data: CreateOrganizationInput) =>
      api.post<{ id: string }>(ORGANIZATIONS_ENDPOINTS.LIST, data),
    onSuccess: async (data) => {
      await invalidate()
      navigate({ to: '/organizations/$orgId', params: { orgId: data.id } })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to create organization'),
  })

  return { createOrgMutation }
}

export function useOrgDetailMutations(orgId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['organization', orgId],
        refetchType: 'active',
      }),
      queryClient.invalidateQueries({
        queryKey: ['organizations'],
        refetchType: 'active',
      }),
      queryClient.invalidateQueries({
        queryKey: ['sidebar-organizations'],
        refetchType: 'active',
      }),
      queryClient.invalidateQueries({
        queryKey: ['teams'],
        refetchType: 'active',
      }),
      // teams list is fetched on organization detail page; ensure it refetches when teams change
      queryClient.refetchQueries({
        queryKey: ['org-teams', orgId],
        type: 'active',
      }),
    ])
  }

  const updateOrgMutation = useMutation({
    mutationFn: (data: UpdateOrganizationInput) =>
      api.patch(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId), data),
    onSuccess: async (_, variables) => {
      toast.success('Organization updated')
      queryClient.setQueryData<Organization[]>(
        ['sidebar-organizations'],
        (previous = []) =>
          previous.map((org) =>
            org.id === orgId
              ? {
                  ...org,
                  ...(variables.name !== undefined && { name: variables.name }),
                  ...(variables.slug !== undefined && { slug: variables.slug }),
                }
              : org,
          ),
      )
      await invalidate()
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to update organization'),
  })

  const deleteOrgMutation = useMutation({
    mutationFn: () => api.delete(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId)),
    onSuccess: async () => {
      toast.success('Organization deleted')
      queryClient.setQueryData<Organization[]>(
        ['sidebar-organizations'],
        (previous = []) =>
          previous.filter((organization) => organization.id !== orgId),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations'] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-organizations'] }),
      ])
      navigate({ to: '/organizations' })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to delete organization'),
  })

  const leaveOrgMutation = useMutation({
    mutationFn: () => api.post(ORGANIZATIONS_ENDPOINTS.LEAVE(orgId)),
    onSuccess: async () => {
      toast.success('You have left the organization')
      queryClient.setQueryData<Organization[]>(
        ['sidebar-organizations'],
        (previous = []) =>
          previous.filter((organization) => organization.id !== orgId),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations'] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-organizations'] }),
      ])
      navigate({ to: '/organizations' })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to leave organization'),
  })

  const inviteOrgMemberMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role?: string }) =>
      api.post(ORGANIZATIONS_ENDPOINTS.INVITE(orgId), { email, role }),
    onSuccess: async (_, variables) => {
      toast.success(`Invitation sent to ${variables.email}`)
      await invalidate()
      queryClient.invalidateQueries({ queryKey: ['org-invitations', orgId] })
    },
    onError: (error) =>
      toast.error(error.message || 'Failed to send invitation'),
  })

  const addOrgMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role?: string }) =>
      api.post(ORGANIZATIONS_ENDPOINTS.ADD_MEMBER(orgId), { userId, role }),
    onSuccess: async () => {
      toast.success('Member added to the organization')
      await invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to add member'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(ORGANIZATIONS_ENDPOINTS.MEMBER_ROLE(orgId, userId), { role }),
    onSuccess: async () => {
      toast.success('Member role updated')
      await invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to update role'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(ORGANIZATIONS_ENDPOINTS.MEMBER_BY_ID(orgId, userId)),
    onSuccess: async () => {
      toast.success('Member removed')
      await invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to remove member'),
  })

  const createTeamMutation = useMutation({
    mutationFn: (data: Omit<CreateTeamInput, 'organizationId'>) =>
      api.post(TEAMS_ENDPOINTS.LIST, { ...data, organizationId: orgId }),
    onSuccess: async () => {
      toast.success('Team created')
      await invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to create team'),
  })

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.delete(TEAMS_ENDPOINTS.BY_ID(teamId)),
    onSuccess: async () => {
      toast.success('Team deleted')
      await invalidate()
    },
    onError: (error) => toast.error(error.message || 'Failed to delete team'),
  })

  return {
    updateOrgMutation,
    deleteOrgMutation,
    leaveOrgMutation,
    inviteOrgMemberMutation,
    addOrgMemberMutation,
    updateRoleMutation,
    removeMemberMutation,
    createTeamMutation,
    deleteTeamMutation,
  }
}
