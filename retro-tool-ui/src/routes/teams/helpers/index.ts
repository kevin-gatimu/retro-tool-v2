/**
 * Teams route helper functions
 */

/**
 * Helper to invalidate team-related queries
 */
export function createTeamQueryInvalidator(queryClient: any) {
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
