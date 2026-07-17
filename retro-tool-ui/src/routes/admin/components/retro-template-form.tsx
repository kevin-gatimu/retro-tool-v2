import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createEmptyColumn } from '../helpers'
import type { EditableColumn, OrganizationAdminRow } from '../types'

export type RetroTemplateFormProps = {
  formName: string
  formDesc: string
  formOrgId: string
  formColumns: EditableColumn[]
  allOrgs: OrganizationAdminRow[]
  onNameChange: (v: string) => void
  onDescChange: (v: string) => void
  onOrgIdChange: (v: string) => void
  onColumnsChange: (cols: EditableColumn[]) => void
}

/**
 * Shared name/description/org/columns form body for the admin retro template
 * create + edit dialogs. Presentational: the parent owns the form state.
 */
export function RetroTemplateForm({
  formName,
  formDesc,
  formOrgId,
  formColumns,
  allOrgs,
  onNameChange,
  onDescChange,
  onOrgIdChange,
  onColumnsChange,
}: RetroTemplateFormProps) {
  const updateColumn = (
    index: number,
    field: keyof EditableColumn,
    value: string,
  ) => {
    onColumnsChange(
      formColumns.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }

  const addColumn = () => {
    onColumnsChange([...formColumns, createEmptyColumn(formColumns.length)])
  }

  const removeColumn = (index: number) => {
    onColumnsChange(
      formColumns
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, order: i })),
    )
  }

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="templateName">Name *</Label>
        <Input
          id="templateName"
          value={formName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Sprint Retrospective"
          maxCharacters={40}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="templateDesc">Description</Label>
        <Textarea
          id="templateDesc"
          value={formDesc}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="Brief description of this template"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="templateOrg">Organization</Label>
        <Select
          value={formOrgId || 'none'}
          onValueChange={(v) => onOrgIdChange(v === 'none' ? '' : v)}
        >
          <SelectTrigger id="templateOrg">
            <SelectValue placeholder="None (global)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (global)</SelectItem>
            {allOrgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Columns</Label>
        <div className="space-y-2">
          {formColumns.map((col, i) => (
            <div key={i} className="flex items-center gap-2">
              <EmojiPicker
                value={col.emoji}
                onSelect={(emoji) => updateColumn(i, 'emoji', emoji)}
                ariaLabel={`Emoji for column ${i + 1}`}
              />
              <Input
                value={col.name}
                onChange={(e) => updateColumn(i, 'name', e.target.value)}
                placeholder="Column name"
                maxCharacters={40}
              />
              <Input
                value={col.prompt}
                onChange={(e) => updateColumn(i, 'prompt', e.target.value)}
                placeholder="Prompt (optional)"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeColumn(i)}
                disabled={formColumns.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addColumn}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Column
          </Button>
        </div>
      </div>
    </div>
  )
}
