import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS, TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateTemplateInput,
  PaginatedTemplatesResponse,
} from '@/common/types/templates'
import type { TemplateListType } from '../types'

/** Query key for a paginated retro templates list. */
export function retroTemplatesQueryKey(
  type: TemplateListType,
  page: number,
  limit: number,
  search: string,
) {
  return ['templates', type, page, limit, search] as const
}

/** Fetch a paginated page of retro templates for the given scope. */
export function fetchRetroTemplates(
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

  return api.get<PaginatedTemplatesResponse>(
    `${TEMPLATES_ENDPOINTS.LIST}?${params.toString()}`,
  )
}

/**
 * Create/delete mutations for retro templates on the `/templates` page. Retro
 * templates are served by the retros controller (`/api/retros/templates`), so
 * writes use `RETROS_ENDPOINTS`. Invalidates the `['templates']` query family.
 */
export function useRetroTemplateMutations({
  onCreateSuccess,
}: {
  onCreateSuccess?: () => void
} = {}) {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['templates'] })

  const createMutation = useMutation({
    mutationFn: (payload: CreateTemplateInput) =>
      api.post(RETROS_ENDPOINTS.TEMPLATES, payload),
    onSuccess: () => {
      toast.success('Template created')
      onCreateSuccess?.()
      void invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(RETROS_ENDPOINTS.TEMPLATE_BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      void invalidateAll()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  return { createMutation, deleteMutation }
}
