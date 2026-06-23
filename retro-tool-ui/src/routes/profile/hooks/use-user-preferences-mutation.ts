import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { USER_PREFERENCES_ENDPOINTS } from '@/lib/api-endpoints'
import type { UserNotificationPreferences } from '@/common/types/user-preferences'

export function useUserPreferencesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<UserNotificationPreferences>) =>
      api.patch<UserNotificationPreferences>(
        USER_PREFERENCES_ENDPOINTS.BASE,
        data,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(['user-preferences'], updated)
      toast.success('Preferences updated')
    },
    onError: () => {
      toast.error('Failed to update preferences')
    },
  })
}
