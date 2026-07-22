import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateTemplateInput, Template } from '@/common/types/templates'
import type { TemplateColumnDraft } from '../types'

const emptyColumns = (): TemplateColumnDraft[] => [
  { name: '', emoji: '', prompt: '', order: 0 },
  { name: '', emoji: '', prompt: '', order: 1 },
  { name: '', emoji: '', prompt: '', order: 2 },
]

/**
 * Retro template management for an organization: the org-scoped templates
 * query, create/update/delete mutations, and the create/edit form state.
 */
export function useOrgTemplates(orgId: string) {
  const queryClient = useQueryClient()

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  )
  const [tplName, setTplName] = useState('')
  const [tplDescription, setTplDescription] = useState('')
  const [tplColumns, setTplColumns] =
    useState<TemplateColumnDraft[]>(emptyColumns())
  const [tplFormError, setTplFormError] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  )

  const templatesQuery = useQuery({
    queryKey: ['org-templates', orgId],
    queryFn: () =>
      api
        .get<{
          templates: Template[]
        }>(`${TEMPLATES_ENDPOINTS.LIST}?type=organization&page=1&limit=100`)
        .then((r) => r.templates.filter((t) => t.organizationId === orgId)),
  })
  const orgTemplates = templatesQuery.data ?? []

  const sortedTplColumns = useMemo(
    () => [...tplColumns].sort((a, b) => a.order - b.order),
    [tplColumns],
  )

  const resetTplForm = () => {
    setEditingTemplateId(null)
    setTplName('')
    setTplDescription('')
    setTplColumns(emptyColumns())
    setTplFormError(null)
  }

  const openCreateTemplateDialog = () => {
    resetTplForm()
    setTemplateDialogOpen(true)
  }

  const openEditTemplateDialog = async (template: Template) => {
    setEditingTemplateId(template.id)
    setTplName(template.name)
    setTplDescription(template.description ?? '')
    try {
      const full = await api.get<
        Template & {
          columns: Array<{
            name: string
            emoji: string | null
            prompt: string | null
            order: number
          }>
        }
      >(TEMPLATES_ENDPOINTS.BY_ID(template.id))
      setTplColumns(
        full.columns.length > 0
          ? full.columns
              .sort((a, b) => a.order - b.order)
              .map((c) => ({
                name: c.name,
                emoji: c.emoji ?? '',
                prompt: c.prompt ?? '',
                order: c.order,
              }))
          : [{ name: '', emoji: '', prompt: '', order: 0 }],
      )
    } catch {
      setTplColumns([{ name: '', emoji: '', prompt: '', order: 0 }])
    }
    setTplFormError(null)
    setTemplateDialogOpen(true)
  }

  const createTemplateMutation = useMutation({
    mutationFn: (payload: CreateTemplateInput) =>
      api.post(TEMPLATES_ENDPOINTS.LIST, payload),
    onSuccess: async () => {
      toast.success('Template created')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateDialogOpen(false)
      resetTplForm()
    },
    onError: (e: Error) =>
      setTplFormError(e.message || 'Failed to create template'),
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<CreateTemplateInput>
    }) => api.patch(TEMPLATES_ENDPOINTS.BY_ID(id), payload),
    onSuccess: async () => {
      toast.success('Template updated')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateDialogOpen(false)
      resetTplForm()
    },
    onError: (e: Error) =>
      setTplFormError(e.message || 'Failed to update template'),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => api.delete(TEMPLATES_ENDPOINTS.BY_ID(id)),
    onSuccess: async () => {
      toast.success('Template deleted')
      await queryClient.refetchQueries({
        queryKey: ['org-templates', orgId],
        type: 'active',
      })
      setTemplateToDelete(null)
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to delete template'),
  })

  const submitTemplate = () => {
    const trimmedName = tplName.trim()
    if (!trimmedName) {
      setTplFormError('Template name is required')
      return
    }
    const cleanedColumns = sortedTplColumns
      .map((c, i) => ({
        name: c.name.trim(),
        emoji: c.emoji.trim() || undefined,
        prompt: c.prompt.trim() || undefined,
        order: i,
      }))
      .filter((c) => c.name.length > 0)
    if (cleanedColumns.length === 0) {
      setTplFormError('At least one column is required')
      return
    }
    const payload: CreateTemplateInput = {
      name: trimmedName,
      description: tplDescription.trim() || undefined,
      organizationId: orgId,
      columns: cleanedColumns,
    }
    if (editingTemplateId) {
      updateTemplateMutation.mutate({ id: editingTemplateId, payload })
    } else {
      createTemplateMutation.mutate(payload)
    }
  }

  return {
    orgTemplates,
    templateDialogOpen,
    setTemplateDialogOpen,
    editingTemplateId,
    tplName,
    setTplName,
    tplDescription,
    setTplDescription,
    tplColumns,
    setTplColumns,
    sortedTplColumns,
    tplFormError,
    templateToDelete,
    setTemplateToDelete,
    resetTplForm,
    openCreateTemplateDialog,
    openEditTemplateDialog,
    createTemplateMutation,
    updateTemplateMutation,
    deleteTemplateMutation,
    submitTemplate,
  }
}
