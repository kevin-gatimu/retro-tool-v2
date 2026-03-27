import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

export function useSessionActions() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['device-sessions'] })

  const revokeSessionMutation = useMutation({
    mutationFn: (token: string) => authClient.revokeSession({ token }),
    onSuccess: invalidate,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to revoke session'),
  })

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: () => authClient.revokeOtherSessions(),
    onSuccess: () => {
      toast.success('All other sessions revoked')
      invalidate()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to revoke sessions'),
  })

  return { revokeSessionMutation, revokeOtherSessionsMutation }
}
