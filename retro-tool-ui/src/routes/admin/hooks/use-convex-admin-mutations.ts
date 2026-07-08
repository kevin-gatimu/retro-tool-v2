import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CONVEX_ADMIN_ENDPOINTS } from '@/lib/api-endpoints'
import type { ConvexCronConfigResponse } from '../types'
import { CONVEX_CRON_CONFIG_KEY } from './use-convex-admin-metrics'

interface UpdateCronConfigPayload {
  schedule?: string
  enabled?: boolean
  tablesToClear?: string[]
}

interface ClearTablesPayload {
  tableNames: string[]
}

export function useUpdateCronConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateCronConfigPayload) =>
      api.put<ConvexCronConfigResponse>(
        CONVEX_ADMIN_ENDPOINTS.CRON_CONFIG,
        payload,
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(CONVEX_CRON_CONFIG_KEY, data)
    },
  })
}

export function useClearConvexTables() {
  return useMutation({
    mutationFn: (payload: ClearTablesPayload) =>
      api.post<{ cleared: string[] }>(
        CONVEX_ADMIN_ENDPOINTS.CLEAR_TABLES,
        payload,
      ),
  })
}
