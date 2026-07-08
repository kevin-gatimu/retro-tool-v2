import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'

interface OrgMember {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
}

interface OrgMembersResponse {
  members: OrgMember[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Search for members of a specific organization by name or email.
 */
export function useOrganizationMemberSearch(
  orgId: string | undefined,
  query: string,
) {
  return useQuery({
    queryKey: ['org-member-search', orgId, query],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        limit: '10',
        search: query,
      })
      const res = await api.get<OrgMembersResponse>(
        `${ORGANIZATIONS_ENDPOINTS.MEMBERS(orgId!)}?${params}`,
      )
      return res.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      }))
    },
    enabled: !!orgId && query.trim().length >= 2,
    staleTime: 10_000,
  })
}
