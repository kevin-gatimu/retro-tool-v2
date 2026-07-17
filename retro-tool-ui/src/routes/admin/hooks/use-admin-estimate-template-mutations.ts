import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ESTIMATE_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateEstimateTemplateInput } from '@/common/types/estimates'

/**
 * Seed/create/update/delete mutations for admin story estimate templates.
 * Invalidates the `['admin-estimate-templates']` query family on success and
 * fires the provided callbacks (used to close dialogs).
 */
export function useAdminEstimateTemplateMutations({
  onCreateSuccess,
  onUpdateSuccess,
  onDeleteSuccess,
}: {
  onCreateSuccess?: () => void
  onUpdateSuccess?: () => void
  onDeleteSuccess?: () => void
} = {}) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-estimate-templates'] })

  const seedMutation = useMutation({
    mutationFn: () => api.post(ESTIMATE_TEMPLATES_ENDPOINTS.SEED),
    onSuccess: () => {
      toast.success('Built-in estimate templates seeded')
      void invalidate()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to seed templates'),
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateEstimateTemplateInput) =>
      api.post(ESTIMATE_TEMPLATES_ENDPOINTS.LIST, body),
    onSuccess: () => {
      toast.success('Template created')
      onCreateSuccess?.()
      void invalidate()
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
      body: Partial<CreateEstimateTemplateInput>
    }) => api.patch(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id), body),
    onSuccess: () => {
      toast.success('Template updated')
      onUpdateSuccess?.()
      void invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to update template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(ESTIMATE_TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: () => {
      toast.success('Template deleted')
      onDeleteSuccess?.()
      void invalidate()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  return { seedMutation, createMutation, updateMutation, deleteMutation }
}
