import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ICEBREAKER_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateIcebreakerTemplateInput } from '@/common/types/icebreakers'

/**
 * Seed/create/update/delete mutations for admin icebreaker templates.
 * Invalidates the `['admin-icebreaker-templates']` query family on success and
 * fires the provided callbacks (used to close dialogs).
 */
export function useAdminIcebreakerTemplateMutations({
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
    queryClient.invalidateQueries({ queryKey: ['admin-icebreaker-templates'] })

  const seedMutation = useMutation({
    mutationFn: () => api.post(ICEBREAKER_TEMPLATES_ENDPOINTS.SEED),
    onSuccess: () => {
      toast.success('Built-in icebreaker templates seeded')
      void invalidate()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to seed templates'),
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateIcebreakerTemplateInput) =>
      api.post(ICEBREAKER_TEMPLATES_ENDPOINTS.LIST, body),
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
      body: Partial<CreateIcebreakerTemplateInput>
    }) => api.patch(ICEBREAKER_TEMPLATES_ENDPOINTS.BY_ID(id), body),
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
      api.delete(ICEBREAKER_TEMPLATES_ENDPOINTS.BY_ID(id)),
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
