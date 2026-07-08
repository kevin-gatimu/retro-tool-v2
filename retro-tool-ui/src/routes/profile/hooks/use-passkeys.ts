import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

const PASSKEYS_QUERY_KEY = ['passkeys'] as const

/** A passkey as returned by the Better Auth passkey plugin. */
export type Passkey = {
  id: string
  name?: string
  createdAt?: string | Date
  deviceType?: string
}

/**
 * List / add / rename / delete the current user's passkeys. The WebAuthn
 * registration ceremony runs in the browser via the client plugin; this hook
 * wraps those actions with TanStack Query so the security page can render and
 * refresh the list. Mirrors the change-password / session-action hooks.
 */
export function usePasskeys() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY })

  const listQuery = useQuery({
    queryKey: PASSKEYS_QUERY_KEY,
    queryFn: async (): Promise<Passkey[]> => {
      const result = await authClient.passkey.listUserPasskeys()
      if (result.error) {
        throw new Error(result.error.message || 'Failed to load passkeys')
      }
      return result.data as Passkey[]
    },
  })

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const result = await authClient.passkey.addPasskey({ name })
      if (result.error) {
        throw new Error(result.error.message || 'Failed to add passkey')
      }
    },
    onSuccess: () => {
      toast.success('Passkey added')
      invalidate()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to add passkey'),
  })

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const result = await authClient.passkey.updatePasskey({ id, name })
      if (result.error) {
        throw new Error(result.error.message || 'Failed to rename passkey')
      }
    },
    onSuccess: () => {
      toast.success('Passkey renamed')
      invalidate()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to rename passkey'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await authClient.passkey.deletePasskey({ id })
      if (result.error) {
        throw new Error(result.error.message || 'Failed to delete passkey')
      }
    },
    onSuccess: () => {
      toast.success('Passkey removed')
      invalidate()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete passkey'),
  })

  return { listQuery, addMutation, renameMutation, deleteMutation }
}
