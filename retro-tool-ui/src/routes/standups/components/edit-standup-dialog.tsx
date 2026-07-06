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
import { cn } from '@/lib/utils'
import { STANDUP_CADENCES } from '@/common/enums/standup.enums'
import type {
  TStandupCadence,
  TStandupScheduleDay,
} from '@/common/enums/standup.enums'
import type { StandupDetail, UpdateStandupInput } from '@/common/types/standups'
import { CADENCE_LABELS, DAY_OPTIONS, QUESTION_COLORS } from '../helpers'

type QuestionDraft = {
  id?: string
  prompt: string
  color: string
  isRequired: boolean
}

interface EditStandupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  standup: StandupDetail
  onSave: (data: UpdateStandupInput) => void
  isSaving: boolean
}

export function EditStandupDialog({
  open,
  onOpenChange,
  standup,
  onSave,
  isSaving,
}: EditStandupDialogProps) {
  const [name, setName] = useState(standup.name)
  const [cadence, setCadence] = useState<TStandupCadence>(standup.cadence)
  const [scheduleDays, setScheduleDays] = useState<TStandupScheduleDay[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [questions, setQuestions] = useState<QuestionDraft[]>([])

  // Re-seed the form from the standup each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setName(standup.name)
    setCadence(standup.cadence)
    setScheduleDays(
      standup.scheduleDays.split(',').filter(Boolean) as TStandupScheduleDay[],
    )
    setStartTime(standup.startTime ?? '09:00')
    setEndTime(standup.endTime ?? '09:30')
    setQuestions(
      standup.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        color: question.color ?? QUESTION_COLORS[0],
        isRequired: question.isRequired,
      })),
    )
  }, [open, standup])

  const isOnce = cadence === STANDUP_CADENCES.Once

  const toggleDay = (day: TStandupScheduleDay) => {
    setScheduleDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(
            (a, b) =>
              DAY_OPTIONS.findIndex((o) => o.value === a) -
              DAY_OPTIONS.findIndex((o) => o.value === b),
          ),
    )
  }

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    )
  }

  const timesValid = startTime < endTime

  const canSave =
    name.trim().length > 0 &&
    (isOnce || scheduleDays.length > 0) &&
    timesValid &&
    questions.length > 0 &&
    questions.every((question) => question.prompt.trim().length > 0) &&
    !isSaving

  const handleSave = () => {
    onSave({
      name: name.trim(),
      cadence,
      // Recurring cadences send days; one-time omits them (API keeps existing).
      ...(isOnce ? {} : { scheduleDays }),
      startTime,
      endTime,
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt.trim(),
        color: question.color,
        isRequired: question.isRequired,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit standup</DialogTitle>
          <DialogDescription>
            Changes apply to future days. Existing submissions keep their
            original questions.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="edit-standup-name">Name</Label>
            <Input
              id="edit-standup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label>Cadence</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.values(STANDUP_CADENCES) as TStandupCadence[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCadence(value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      cadence === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:border-primary/50',
                    )}
                  >
                    {CADENCE_LABELS[value]}
                  </button>
                ),
              )}
            </div>
          </div>

          {!isOnce && (
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'w-12 rounded-md border py-1 text-center text-xs transition-colors',
                      scheduleDays.includes(day.value)
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'hover:border-primary/50',
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-32"
                aria-label="Start time"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-32"
                aria-label="End time"
              />
            </div>
            {!timesValid && (
              <p className="text-xs text-destructive">
                End time must be after start time.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Questions</Label>
            {questions.map((question, index) => (
              <div
                key={question.id ?? `new-${index}`}
                className="flex items-start gap-2 rounded-lg border p-2.5"
                style={{ borderLeftWidth: 4, borderLeftColor: question.color }}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={question.prompt}
                    onChange={(event) =>
                      updateQuestion(index, { prompt: event.target.value })
                    }
                    maxLength={500}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={question.isRequired}
                        onCheckedChange={(checked) =>
                          updateQuestion(index, {
                            isRequired: checked === true,
                          })
                        }
                      />
                      Required
                    </label>
                    <div className="flex items-center gap-1">
                      {QUESTION_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateQuestion(index, { color })}
                          className={cn(
                            'h-4 w-4 rounded-full border-2 transition-transform',
                            question.color === color
                              ? 'scale-110 border-foreground'
                              : 'border-transparent',
                          )}
                          style={{ backgroundColor: color }}
                        >
                          <span className="sr-only">Set color {color}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={questions.length <= 1}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove question</span>
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuestions((prev) => [
                  ...prev,
                  {
                    prompt: '',
                    color:
                      QUESTION_COLORS[prev.length % QUESTION_COLORS.length],
                    isRequired: false,
                  },
                ])
              }
              disabled={questions.length >= 10}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add question
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
