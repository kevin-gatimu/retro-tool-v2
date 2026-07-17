/**
 * Templates route (`/templates`) type definitions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical response/domain types (re-exported for local relative imports)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  TemplateWithColumns,
  PaginatedTemplatesResponse,
} from '@/common/types/templates'
export type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
} from '@/common/types/estimates'

// ─────────────────────────────────────────────────────────────────────────────
// Local form-draft types
// ─────────────────────────────────────────────────────────────────────────────

/** Editable draft row for a retro template column in the create dialog. */
export type ColumnDraft = { name: string; emoji: string; prompt: string }

/** Query scope for a paginated template list. */
export type TemplateListType = 'built-in' | 'organization'
