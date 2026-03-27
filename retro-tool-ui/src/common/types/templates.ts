export interface Template {
  id: string
  name: string
  description: string | null
  isBuiltIn: boolean
  organizationId: string | null
  organizationName?: string | null
  createdAt: Date
  columns?: TemplateColumn[]
}

export interface TemplateColumn {
  id: string
  name: string
  emoji: string | null
  prompt: string | null
  order: number
}

/**
 * Editable column for template creation/editing
 */
export type EditableColumn = {
  name: string
  emoji: string
  prompt: string
  order: number
}

/**
 * Template with columns (expanded version)
 */
export type TemplateWithColumns = {
  id: string
  name: string
  description?: string | null
  organizationId?: string | null
  organizationName?: string | null
  isBuiltIn: boolean
  createdAt: string | Date
  updatedAt: string | Date
  columns: TemplateColumn[]
}

/**
 * Paginated templates response
 */
export type PaginatedTemplatesResponse = {
  templates: TemplateWithColumns[]
  total: number
  page: number
  limit: number
}

export interface CreateTemplateInput {
  name: string
  description?: string
  organizationId?: string
  columns: {
    name: string
    emoji?: string
    prompt?: string
    order?: number
  }[]
}
