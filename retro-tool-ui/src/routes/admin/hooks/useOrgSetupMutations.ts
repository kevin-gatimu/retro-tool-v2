import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreatedOrg, SelectedUser, TeamDraft } from '../types'

interface OrgSetupMutationOptions {
  orgName: string
  orgSlug: string
  createdOrg: CreatedOrg | null
  owner: SelectedUser | null
  admins: SelectedUser[]
  members: SelectedUser[]
  teams: TeamDraft[]
  setCreatedOrg: (org: CreatedOrg) => void
  setStep: (step: number) => void
  setTeams: (teams: TeamDraft[]) => void
}

/**
 * Hook for all org setup wizard mutations
 */
export function useOrgSetupMutations({
  orgName,
  orgSlug,
  createdOrg,
  owner,
  admins,
  members,
  teams,
  setCreatedOrg,
  setStep,
  setTeams,
}: OrgSetupMutationOptions) {
  const createOrgMutation = useMutation({
    mutationFn: () =>
      api.post<CreatedOrg>(ORGANIZATIONS_ENDPOINTS.LIST, {
        name: orgName.trim(),
        slug: orgSlug.trim(),
      }),
    onSuccess: (org) => {
      setCreatedOrg(org)
      toast.success(`Organisation "${org.name}" created`)
      setStep(2)
    },
    onError: (e: Error) => {
      const msg = e.message || 'Failed to create organisation'
      if (msg.toLowerCase().includes('slug already exists')) {
        toast.error(
          'An organisation with this slug already exists. Please choose a different slug.',
        )
      } else {
        toast.error(msg)
      }
    },
  })

  const assignOwnerMutation = useMutation({
    mutationFn: () =>
      api.post(ORGANIZATIONS_ENDPOINTS.INVITE(createdOrg!.id), {
        email: owner!.email,
        role: 'org-owner',
      }),
    onSuccess: () => {
      toast.success(`${owner!.name} set as owner`)
      setStep(3)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to set owner'),
  })

  const addAdminsMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        admins.map((u) =>
          api.post(ORGANIZATIONS_ENDPOINTS.INVITE(createdOrg!.id), {
            email: u.email,
            role: 'org-admin',
          }),
        ),
      ),
    onSuccess: () => {
      toast.success(`${admins.length} admin(s) added`)
      setStep(4)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add admins'),
  })

  const addMembersMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        members.map((u) =>
          api.post(ORGANIZATIONS_ENDPOINTS.INVITE(createdOrg!.id), {
            email: u.email,
            role: 'member',
          }),
        ),
      ),
    onSuccess: () => {
      toast.success(`${members.length} member(s) added`)
      setStep(5)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add members'),
  })

  const createTeamsMutation = useMutation({
    mutationFn: async () => {
      const seen = new Set<string>()
      const validTeams = teams.filter((t) => {
        const key = t.name.trim().toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      for (const t of validTeams) {
        const created = await api.post<{ id: string }>(TEAMS_ENDPOINTS.LIST, {
          name: t.name.trim(),
          organizationId: createdOrg!.id,
        })
        if (t.leadId) {
          await api.post(TEAMS_ENDPOINTS.MEMBERS(created.id), {
            userId: t.leadId,
            tag: 'team-lead',
          })
        }
      }
    },
    retry: 0,
    onSuccess: () => {
      toast.success('Teams created successfully')
      setTeams([{ name: '' }])
      setStep(6)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create teams'),
  })

  return {
    createOrgMutation,
    assignOwnerMutation,
    addAdminsMutation,
    addMembersMutation,
    createTeamsMutation,
  }
}
