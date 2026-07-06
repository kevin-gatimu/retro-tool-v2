import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { STANDUPS_ENDPOINTS } from '@/lib/api-endpoints'

export function useSendStandupReport(
  standupId: string,
  options?: { onSuccess?: () => void },
) {
  return useMutation({
    mutationFn: (body: { date?: string; recipients?: string[] }) =>
      api.post<{ sent: number }>(
        STANDUPS_ENDPOINTS.SEND_REPORT(standupId),
        body,
      ),
    onSuccess: (data) => {
      toast.success(
        `Report emailed to ${data.sent} recipient${data.sent === 1 ? '' : 's'}`,
      )
      options?.onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send report')
    },
  })
}
