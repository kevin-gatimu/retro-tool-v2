import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UserRow } from '@/components/tables/user-columns'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { UserDetails } from '../types'

/**
 * State + data loader for the "User Details" modal. The selected row is local UI
 * state; the full record is owned by TanStack Query, keyed on the user id and
 * enabled only while the modal has a target user (so closing clears the view and
 * reopening reuses the cache). Loading/error state is derived from the query.
 */
export function useUserDetailsModal() {
  const [detailsModalUser, setDetailsModalUser] = useState<UserRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-user-details', detailsModalUser?.id],
    queryFn: () =>
      api.get<UserDetails>(USERS_ENDPOINTS.DETAILS(detailsModalUser!.id)),
    enabled: Boolean(detailsModalUser),
  })

  const loadUserDetails = useCallback((user: UserRow) => {
    setDetailsModalUser(user)
  }, [])

  const closeUserDetails = useCallback(() => {
    setDetailsModalUser(null)
  }, [])

  return {
    detailsModalUser,
    userDetails: query.data ?? null,
    userDetailsError: query.isError,
    isLoadingUserDetails: query.isLoading,
    loadUserDetails,
    closeUserDetails,
  }
}
