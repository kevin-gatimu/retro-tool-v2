import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateTemplateInput } from '@/common/types/templates'
import { api } from '@/lib/api'
import { TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'

export function useAdminTemplateMutations({
  onCreateSuccess,
  onUpdateSuccess,
}: {
  onCreateSuccess?: () => void
  onUpdateSuccess?: () => void
} = {}) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-templates'] })

  const seedMutation = useMutation({
    mutationFn: () => api.post(TEMPLATES_ENDPOINTS.SEED),
    onSuccess: () => {
      toast.success('Built-in templates seeded successfully')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to seed templates')
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateTemplateInput) =>
      api.post(TEMPLATES_ENDPOINTS.LIST, payload),
    onSuccess: () => {
      toast.success('Template created successfully')
      onCreateSuccess?.()
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create template')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string
      payload: Partial<CreateTemplateInput>
    }) => api.patch(TEMPLATES_ENDPOINTS.BY_ID(templateId), payload),
    onSuccess: () => {
      toast.success('Template updated successfully')
      onUpdateSuccess?.()
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update template')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.delete(TEMPLATES_ENDPOINTS.BY_ID(templateId)),
    onSuccess: () => {
      toast.success('Template deleted')
      void invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete template')
    },
  })

  return { seedMutation, createMutation, updateMutation, deleteMutation }
}
