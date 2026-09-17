import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CONVEX_ADMIN_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  OperationalMetrics,
  UsageMetrics,
  ConvexCronConfigResponse,
} from '../types'

export const CONVEX_OPERATIONAL_METRICS_KEY = [
  'convex-admin',
  'metrics',
  'operational',
] as const
export const CONVEX_USAGE_METRICS_KEY = [
  'convex-admin',
  'metrics',
  'usage',
] as const
export const CONVEX_CRON_CONFIG_KEY = ['convex-admin', 'cron-config'] as const

export function useConvexOperationalMetrics(
  rangeMinutes = 60,
  pollingEnabled = true,
) {
  const refreshInterval =
    rangeMinutes <= 360
      ? 30_000
      : rangeMinutes <= 1440
        ? 60_000
        : rangeMinutes <= 43_200
          ? 5 * 60_000
          : 15 * 60_000

  return useQuery({
    queryKey: [...CONVEX_OPERATIONAL_METRICS_KEY, rangeMinutes],
    queryFn: () =>
      api.get<OperationalMetrics>(
        `${CONVEX_ADMIN_ENDPOINTS.METRICS_OPERATIONAL}?rangeMinutes=${rangeMinutes}`,
      ),
    staleTime: refreshInterval / 2,
    refetchInterval: pollingEnabled ? refreshInterval : false,
    refetchOnWindowFocus: false,
  })
}

export function useConvexUsageMetrics() {
  return useQuery({
    queryKey: CONVEX_USAGE_METRICS_KEY,
    queryFn: () =>
      api.get<UsageMetrics | null>(CONVEX_ADMIN_ENDPOINTS.METRICS_USAGE),
    staleTime: 5 * 60_000,
  })
}

export function useConvexCronConfig() {
  return useQuery({
    queryKey: CONVEX_CRON_CONFIG_KEY,
    queryFn: () =>
      api.get<ConvexCronConfigResponse>(CONVEX_ADMIN_ENDPOINTS.CRON_CONFIG),
    staleTime: 60_000,
  })
}
