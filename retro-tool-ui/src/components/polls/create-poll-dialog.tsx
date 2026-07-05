import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreatePollInput } from '@/common/types/polls'

type OptionDraft = { label: string; emoji: string }

const DEFAULT_OPTIONS: OptionDraft[] = [
  { label: '', emoji: '' },
  { label: '', emoji: '' },
]

interface CreatePollDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fixed context: team the poll belongs to. */
  teamId: string
  /** When set, the poll is attached to that standup day. */
  standupId?: string
  entryDate?: string
  onCreate: (data: CreatePollInput) => void
  isCreating: boolean
}

export function CreatePollDialog({
  open,
  onOpenChange,
  teamId,
  standupId,
  entryDate,
  onCreate,
  isCreating,
}: CreatePollDialogProps) {
  const [question, setQuestion] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [options, setOptions] = useState<OptionDraft[]>(DEFAULT_OPTIONS)

  useEffect(() => {
    if (!open) return
    setQuestion('')
    setIsAnonymous(false)
    setOptions(DEFAULT_OPTIONS.map((option) => ({ ...option })))
  }, [open])

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((prev) =>
      prev.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    )
  }

  const canSubmit =
    question.trim().length > 0 &&
    options.length >= 2 &&
    options.every((option) => option.label.trim().length > 0) &&
    !isCreating

  const handleSubmit = () => {
    onCreate({
      question: question.trim(),
      teamId,
      standupId,
      entryDate,
      isAnonymous,
      options: options.map((option) => ({
        label: option.label.trim(),
        emoji: option.emoji.trim() || undefined,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Poll</DialogTitle>
          <DialogDescription>
            Ask your team a quick question with predefined answers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="How are you feeling today?"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option.emoji}
                  onChange={(event) =>
                    updateOption(index, { emoji: event.target.value })
                  }
                  placeholder="😄"
                  maxLength={4}
                  className="w-14 text-center"
                />
                <Input
                  value={option.label}
                  onChange={(event) =>
                    updateOption(index, { label: event.target.value })
                  }
                  placeholder={`Option ${index + 1}`}
                  maxLength={255}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={options.length <= 2}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove option</span>
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setOptions((prev) => [...prev, { label: '', emoji: '' }])
              }
              disabled={options.length >= 10}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add option
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
            />
            Anonymous poll (hide who voted for what)
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? 'Creating…' : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
