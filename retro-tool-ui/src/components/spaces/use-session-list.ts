import { useMemo } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

/** A page of completed items as returned by the paginated endpoints. */
export interface CompletedPage<TCompleted> {
  items: TCompleted[]
  total: number
  page: number
  limit: number
}

interface UseSessionListParams<TOngoing, TCompleted> {
  /** Query key for the (unpaginated) ongoing list. */
  ongoingKey: QueryKey
  /** Fetch all ongoing sessions (always few). */
  fetchOngoing: () => Promise<TOngoing[]>
  /** Query key for the paginated completed list (include teamId/search). */
  completedKey: QueryKey
  /** Fetch one page of completed sessions. */
  fetchCompleted: (page: number) => Promise<CompletedPage<TCompleted>>
  /** Gate the completed query (e.g. only when "show completed" is on). */
  completedEnabled?: boolean
  staleTime?: number
}

export interface UseSessionListResult<TOngoing, TCompleted> {
  ongoing: TOngoing[]
  completed: TCompleted[]
  completedTotal: number
  completedLoaded: number
  hasMore: boolean
  isLoading: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  loadMore: () => void
  refetch: () => void
}

/**
 * Shared data layer for the grouped session pages (retros + estimates):
 *
 * - Ongoing sessions are fetched in full via a normal query (always few).
 * - Completed sessions are server-paginated via useInfiniteQuery, accumulating
 *   pages behind a "Load more" affordance so 300+ completed never load at once.
 *
 * Callers supply teamId/search inside the query keys + fetchers so changing the
 * active space or search resets the paginated set.
 */
export function useSessionList<TOngoing, TCompleted>({
  ongoingKey,
  fetchOngoing,
  completedKey,
  fetchCompleted,
  completedEnabled = true,
  staleTime = 30_000,
}: UseSessionListParams<TOngoing, TCompleted>): UseSessionListResult<
  TOngoing,
  TCompleted
> {
  const queryClient = useQueryClient()

  const ongoingQuery = useQuery({
    queryKey: ongoingKey,
    queryFn: fetchOngoing,
    staleTime,
  })

  const completedQuery = useInfiniteQuery({
    queryKey: completedKey,
    queryFn: ({ pageParam }) => fetchCompleted(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    enabled: completedEnabled,
    staleTime,
  })

  const completed = useMemo(
    () => completedQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [completedQuery.data],
  )
  const completedTotal = completedQuery.data?.pages[0]?.total ?? 0

  return {
    ongoing: ongoingQuery.data ?? [],
    completed,
    completedTotal,
    completedLoaded: completed.length,
    hasMore: Boolean(completedQuery.hasNextPage),
    isLoading: ongoingQuery.isLoading || completedQuery.isLoading,
    isFetching: ongoingQuery.isFetching || completedQuery.isFetching,
    isFetchingNextPage: completedQuery.isFetchingNextPage,
    loadMore: () => {
      if (completedQuery.hasNextPage && !completedQuery.isFetchingNextPage) {
        void completedQuery.fetchNextPage()
      }
    },
    refetch: () => {
      void queryClient.invalidateQueries({ queryKey: ongoingKey })
      void queryClient.invalidateQueries({ queryKey: completedKey })
    },
  }
}
