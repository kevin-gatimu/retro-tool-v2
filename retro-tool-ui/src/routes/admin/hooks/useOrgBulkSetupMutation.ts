import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'

export interface BulkSetupTeam {
  name: string
  leadId?: string
}

export interface BulkSetupPayload {
  name: string
  slug: string
  logo?: string
  ownerId?: string
  adminIds: string[]
  memberIds: string[]
  teams: BulkSetupTeam[]
}

export interface BulkSetupResult {
  org: { id: string; name: string; slug: string }
  memberCount: number
  teamCount: number
}

export function useOrgBulkSetupMutation() {
  return useMutation({
    mutationFn: (payload: BulkSetupPayload) =>
      api.post<BulkSetupResult>(ORGANIZATIONS_ENDPOINTS.BULK_SETUP, payload),
    onError: (e: Error) => {
      const msg = e.message || 'Failed to create organisation'
      if (
        msg.toLowerCase().includes('slug already exists') ||
        msg.toLowerCase().includes('slug already in use')
      ) {
        toast.error(
          'An organisation with this slug already exists. Go back and choose a different slug.',
        )
      } else {
        toast.error(msg)
      }
    },
  })
}
