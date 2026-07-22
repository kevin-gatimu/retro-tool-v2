import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { User } from '@/common/types/users'

/**
 * Debounced user search backed by TanStack Query. Replaces the previous
 * fetch-in-`useEffect` + manual loading/results state: the search term is
 * debounced, the request only runs for terms ≥ 2 chars, and results/loading
 * come straight from the query.
 */
export function useUserSearch(searchTerm: string) {
  const debouncedTerm = useDebouncedValue(searchTerm, 300)
  const enabled = debouncedTerm.trim().length >= 2

  const query = useQuery({
    queryKey: ['user-search', debouncedTerm],
    queryFn: () =>
      api.get<User[]>(
        `${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(debouncedTerm)}`,
      ),
    enabled,
    placeholderData: (prev) => prev,
  })

  return {
    results: enabled ? (query.data ?? []) : [],
    isSearching: enabled && query.isFetching,
  }
}
