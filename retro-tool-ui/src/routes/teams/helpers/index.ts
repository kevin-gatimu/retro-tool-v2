/**
 * Teams route helper functions
 */
import type { QueryClient } from '@tanstack/react-query'

/**
 * Helper to invalidate team-related queries
 */
export function createTeamQueryInvalidator(queryClient: QueryClient) {
  return {
    invalidateTeam: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    invalidateTeams: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  }
}
