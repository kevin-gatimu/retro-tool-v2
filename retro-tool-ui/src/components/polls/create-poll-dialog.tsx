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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  CreatePollInput,
  PollView,
  UpdatePollInput,
} from '@/common/types/polls'
import type { Team } from '@/common/types/teams'

type OptionDraft = { id?: string; label: string; emoji: string }

const DEFAULT_OPTIONS: OptionDraft[] = [
  { label: '', emoji: '' },
  { label: '', emoji: '' },
]

interface CreatePollDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fixed context: team the poll belongs to. Provide this OR `teams`. */
  teamId?: string
  /** Selectable context: let the user pick the team inside the modal. */
  teams?: Team[]
  /** When set, the poll is attached to that standup day. */
  standupId?: string
  entryDate?: string
  /** When provided, the dialog edits this poll instead of creating one. */
  editingPoll?: PollView
  onCreate: (data: CreatePollInput) => void
  onUpdate?: (data: UpdatePollInput) => void
  isCreating: boolean
}

export function CreatePollDialog({
  open,
  onOpenChange,
  teamId,
  teams,
  standupId,
  entryDate,
  editingPoll,
  onCreate,
  onUpdate,
  isCreating,
}: CreatePollDialogProps) {
  const isEdit = !!editingPoll
  const [question, setQuestion] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [options, setOptions] = useState<OptionDraft[]>(DEFAULT_OPTIONS)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  // Show the in-modal team picker only when creating with a list of teams and
  // there is more than one to choose from. The user must pick explicitly — we
  // never pre-select a team for them. Editing keeps the poll's own team.
  const showTeamPicker = !isEdit && !!teams && teams.length > 1
  const effectiveTeamId = teams
    ? teams.length === 1
      ? teams[0].id
      : selectedTeamId
    : (teamId ?? '')

  useEffect(() => {
    if (!open) return
    if (editingPoll) {
      setQuestion(editingPoll.question)
      setIsAnonymous(editingPoll.isAnonymous)
      setOptions(
        editingPoll.options
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((option) => ({
            id: option.id,
            label: option.label,
            emoji: option.emoji ?? '',
          })),
      )
    } else {
      setQuestion('')
      setIsAnonymous(false)
      setOptions(DEFAULT_OPTIONS.map((option) => ({ ...option })))
    }
    setSelectedTeamId('')
  }, [open, editingPoll])

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((prev) =>
      prev.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    )
  }

  const canSubmit =
    question.trim().length > 0 &&
    (isEdit || effectiveTeamId.length > 0) &&
    options.length >= 2 &&
    options.every((option) => option.label.trim().length > 0) &&
    !isCreating

  const handleSubmit = () => {
    if (isEdit) {
      onUpdate?.({
        question: question.trim(),
        isAnonymous,
        options: options.map((option) => ({
          id: option.id,
          label: option.label.trim(),
          emoji: option.emoji.trim() || undefined,
        })),
      })
      return
    }
    onCreate({
      question: question.trim(),
      teamId: effectiveTeamId,
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
      <DialogContent className="border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Poll' : 'Create Poll'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the question and options. Votes on options you keep are preserved.'
              : 'Ask your team a quick question with predefined answers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showTeamPicker && (
            <div className="space-y-2">
              <Label htmlFor="poll-team">Team</Label>
              <Select value={effectiveTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="poll-team" className="w-full bg-background">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="How are you feeling today?"
              maxLength={500}
              className="bg-background"
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
                  className="w-14 text-center bg-background"
                />
                <Input
                  value={option.label}
                  onChange={(event) =>
                    updateOption(index, { label: event.target.value })
                  }
                  placeholder={`Option ${index + 1}`}
                  maxLength={255}
                  className="bg-background"
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
            {isCreating
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save Changes'
                : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
