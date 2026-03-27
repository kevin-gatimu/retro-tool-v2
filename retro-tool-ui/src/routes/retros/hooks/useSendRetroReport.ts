import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'

export function useSendRetroReport(retroId: string) {
  return useMutation({
    mutationFn: (body: { recipients?: string[] }) =>
      api.post<{ sent: number }>(RETROS_ENDPOINTS.SEND_REPORT(retroId), body),
    onSuccess: (data) => {
      toast.success(
        `Report sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send report')
    },
  })
}
