import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ESTIMATE_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateEstimateTemplateInput,
  PaginatedEstimateTemplatesResponse,
} from '@/common/types/estimates'
import type { TemplateListType } from '../types'

/** Query key for a paginated estimate templates list. */
export function estimateTemplatesQueryKey(
  type: TemplateListType,
  page: number,
  limit: number,
  search: string,
) {
  return ['estimate-templates', type, page, limit, search] as const
}

/** Fetch a paginated page of estimate templates for the given scope. */
export function fetchEstimateTemplates(
  type: TemplateListType,
  page: number,
  limit: number,
  search: string,
) {
  const params = new URLSearchParams({
    type,
    page: String(page),
    limit: String(limit),
  })
  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }

  return api.get<PaginatedEstimateTemplatesResponse>(
    `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?${params.toString()}`,
  )
}

/** Payload for updating an estimate template from the `/templates` page. */
export interface UpdateEstimateTemplatePayload {
  name: string
  description: string | null
  color: string | null
  values: {
    label: string
    value: string
    order: number
    color: string | null
    description: string | null
  }[]
}

/**
 * Create/update/delete mutations for estimate templates on the `/templates`
 * page. Invalidates the `['estimate-templates']` query family on success.
 */
export function useEstimateTemplateMutations({
  onCreateSuccess,
  onUpdateSuccess,
}: {
  onCreateSuccess?: () => void
  onUpdateSuccess?: () => void
} = {}) {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['estimate-templates'] })

  const createMutation = useMutation({
    mutationFn: (body: CreateEstimateTemplateInput) =>
      api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, body),
    onSuccess: () => {
      toast.success('Estimate template created')
      onCreateSuccess?.()
      void invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create template'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: UpdateEstimateTemplatePayload
    }) => api.patch(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id), body),
    onSuccess: () => {
      toast.success('Template updated')
      onUpdateSuccess?.()
      void invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to update template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      void invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  return { createMutation, updateMutation, deleteMutation }
}
