import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PencilLine, Plus, Shuffle, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { api } from '@/lib/api'
import { ICEBREAKER_TEMPLATES_ENDPOINTS } from '@/lib/api-endpoints'
import { ICEBREAKER_SELECTION_MODES } from '@/common/enums/icebreaker.enums'
import type {
  TIcebreakerFlavour,
  TIcebreakerSelectionMode,
} from '@/common/enums/icebreaker.enums'
import type {
  CreateIcebreakerSessionInput,
  PaginatedIcebreakerTemplatesResponse,
} from '@/common/types/icebreakers'
import { cn } from '@/lib/utils'
import {
  ALL_FLAVOURS,
  FLAVOUR_ACCENTS,
  FLAVOUR_LABELS,
  buildSessionSource,
  defaultSessionName,
} from '@/routes/icebreakers/helpers'

interface StartIcebreakerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Team the session belongs to (fixed — no picker in the standup room). */
  teamId: string
  /** Attaches the session to a standup day so it shows in that room's feed. */
  standupId: string
  entryDate: string
  onCreate: (data: CreateIcebreakerSessionInput) => void
  isCreating: boolean
}

/**
 * Modal for spinning up an icebreaker from inside a standup day. Mirrors the
 * three source modes of `/icebreakers/new` (template / random / write-your-own)
 * but with the team fixed to the standup's team.
 */
export function StartIcebreakerDialog({
  open,
  onOpenChange,
  teamId,
  standupId,
  entryDate,
  onCreate,
  isCreating,
}: StartIcebreakerDialogProps) {
  const [name, setName] = useState(defaultSessionName)
  const [selectionMode, setSelectionMode] = useState<TIcebreakerSelectionMode>(
    ICEBREAKER_SELECTION_MODES.Ordered,
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  )
  const [flavourFilter, setFlavourFilter] = useState<TIcebreakerFlavour | null>(
    null,
  )
  const [customPrompts, setCustomPrompts] = useState<string[]>(['', ''])

  // Reset to defaults each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName(defaultSessionName())
      setSelectionMode(ICEBREAKER_SELECTION_MODES.Ordered)
      setSelectedTemplateId(null)
      setFlavourFilter(null)
      setCustomPrompts(['', ''])
    }
  }, [open])

  const { data: templatesData } = useQuery({
    queryKey: ['new-icebreaker-templates'],
    queryFn: () =>
      api.get<PaginatedIcebreakerTemplatesResponse>(
        `${ICEBREAKER_TEMPLATES_ENDPOINTS.LIST}?page=1&limit=50`,
      ),
    enabled: open,
  })
  const templates = templatesData?.templates ?? []

  const isRandom = selectionMode === ICEBREAKER_SELECTION_MODES.Random
  const isCustom = selectionMode === ICEBREAKER_SELECTION_MODES.Custom

  const filledPrompts = customPrompts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)

  const updatePrompt = (index: number, value: string) =>
    setCustomPrompts((prev) =>
      prev.map((prompt, i) => (i === index ? value : prompt)),
    )
  const addPrompt = () => setCustomPrompts((prev) => [...prev, ''])
  const removePrompt = (index: number) =>
    setCustomPrompts((prev) => prev.filter((_, i) => i !== index))

  const hasSource =
    isRandom ||
    (isCustom ? filledPrompts.length > 0 : selectedTemplateId !== null)

  const canSubmit = name.trim().length > 0 && hasSource && !isCreating

  const handleSubmit = () => {
    onCreate({
      name: name.trim(),
      teamId,
      standupId,
      entryDate,
      selectionMode,
      ...buildSessionSource({
        selectionMode,
        flavourFilter,
        filledPrompts,
        selectedTemplateId,
      }),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start an icebreaker</DialogTitle>
          <DialogDescription>
            Warm up the standup with a quick icebreaker for this day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icebreaker-name">Session name</Label>
            <Input
              id="icebreaker-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Standup warm-up"
              maxLength={255}
            />
          </div>

          <RadioGroup
            value={selectionMode}
            onValueChange={(value) =>
              setSelectionMode(value as TIcebreakerSelectionMode)
            }
            className="grid gap-2"
          >
            <Label
              htmlFor="ib-mode-ordered"
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                !isRandom && !isCustom && 'border-primary ring-1 ring-primary',
              )}
            >
              <RadioGroupItem
                value={ICEBREAKER_SELECTION_MODES.Ordered}
                id="ib-mode-ordered"
              />
              <span className="text-sm font-medium">Pick a template</span>
            </Label>
            <Label
              htmlFor="ib-mode-random"
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                isRandom && 'border-primary ring-1 ring-primary',
              )}
            >
              <RadioGroupItem
                value={ICEBREAKER_SELECTION_MODES.Random}
                id="ib-mode-random"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Shuffle className="h-4 w-4" />
                Random mix
              </span>
            </Label>
            <Label
              htmlFor="ib-mode-custom"
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                isCustom && 'border-primary ring-1 ring-primary',
              )}
            >
              <RadioGroupItem
                value={ICEBREAKER_SELECTION_MODES.Custom}
                id="ib-mode-custom"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <PencilLine className="h-4 w-4" />
                Write your own
              </span>
            </Label>
          </RadioGroup>

          {isRandom && (
            <div className="space-y-2">
              <Label>Flavour (optional)</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFlavourFilter(null)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm',
                    flavourFilter === null &&
                      'border-primary bg-primary/10 text-primary',
                  )}
                >
                  Any
                </button>
                {ALL_FLAVOURS.map((flavour) => (
                  <button
                    key={flavour}
                    type="button"
                    onClick={() => setFlavourFilter(flavour)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm',
                      flavourFilter === flavour &&
                        'border-primary bg-primary/10 text-primary',
                    )}
                  >
                    {FLAVOUR_LABELS[flavour]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCustom && (
            <div className="space-y-3">
              <Label>Your prompts</Label>
              <div className="space-y-2">
                {customPrompts.map((prompt, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Textarea
                        value={prompt}
                        onChange={(event) =>
                          updatePrompt(index, event.target.value)
                        }
                        placeholder={`Prompt ${index + 1}`}
                        maxCharacters={500}
                        showCharCount={false}
                        className="min-h-24"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-1 shrink-0 text-muted-foreground"
                      disabled={customPrompts.length <= 1}
                      onClick={() => removePrompt(index)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove prompt</span>
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={customPrompts.length >= 20}
                onClick={addPrompt}
              >
                <Plus className="h-4 w-4" />
                Add prompt
              </Button>
            </div>
          )}

          {!isRandom && !isCustom && (
            <div className="space-y-2">
              <Label>Choose a deck</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No icebreaker templates available yet.
                </p>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors hover:border-primary/50',
                        selectedTemplateId === template.id &&
                          'border-primary ring-1 ring-primary',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {template.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'shrink-0',
                            FLAVOUR_ACCENTS[template.flavour],
                          )}
                        >
                          {FLAVOUR_LABELS[template.flavour]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.prompts.length} prompt
                        {template.prompts.length === 1 ? '' : 's'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? 'Starting…' : 'Start icebreaker'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
