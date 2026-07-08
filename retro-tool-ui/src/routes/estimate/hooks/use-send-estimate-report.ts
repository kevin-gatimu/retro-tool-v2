import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'

export function useSendEstimateReport(
  sessionId: string,
  options?: { onSuccess?: () => void },
) {
  return useMutation({
    mutationFn: (body: { recipients?: string[] }) =>
      api.post<{ sent: number }>(
        ESTIMATES_ENDPOINTS.SEND_REPORT(sessionId),
        body,
      ),
    onSuccess: (data) => {
      toast.success(
        `Report sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}`,
      )
      options?.onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send report')
    },
  })
}
