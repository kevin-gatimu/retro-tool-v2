import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CalendarCheck, GripVertical, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import { cn } from '@/lib/utils'
import type { Team } from '@/common/types/teams'
import type { CreateStandupInput } from '@/common/types/standups'
import { STANDUP_CADENCES } from '@/common/enums/standup.enums'
import type {
  TStandupCadence,
  TStandupScheduleDay,
} from '@/common/enums/standup.enums'
import { useStandupMutations } from './hooks/use-standup-mutations'
import {
  CADENCE_LABELS,
  DAY_OPTIONS,
  DEFAULT_QUESTIONS,
  QUESTION_COLORS,
  defaultStandupName,
  defaultStandupTimes,
} from './helpers'

export const Route = createFileRoute('/standups/new')({
  component: NewStandupPage,
})

type QuestionDraft = {
  id: string
  prompt: string
  color: string
  isRequired: boolean
}

const WEEKDAYS: TStandupScheduleDay[] = ['MON', 'TUE', 'WED', 'THU', 'FRI']

function NewStandupPage() {
  // Pre-fill with the current day/date/time (e.g. "Standup - Monday 9th March,
  // 8pm") so a lead can create one without typing a name. Computed once on
  // mount; still editable.
  const [name, setName] = useState(defaultStandupName)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [cadence, setCadence] = useState<TStandupCadence>(
    STANDUP_CADENCES.Daily,
  )
  const [scheduleDays, setScheduleDays] =
    useState<TStandupScheduleDay[]>(WEEKDAYS)
  const initialTimes = defaultStandupTimes()
  const [startTime, setStartTime] = useState(initialTimes.start)
  const [endTime, setEndTime] = useState(initialTimes.end)
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    DEFAULT_QUESTIONS.map((q) => ({
      id: crypto.randomUUID(),
      prompt: q.prompt,
      color: q.color,
      isRequired: true,
    })),
  )
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(
    null,
  )

  // Require 8px of movement before a drag starts so clicks on the row's inputs
  // and buttons still register normally.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const { createStandupMutation } = useStandupMutations()

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })

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

  const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    )
  }

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        prompt: '',
        color: QUESTION_COLORS[prev.length % QUESTION_COLORS.length],
        isRequired: false,
      },
    ])
  }

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((question) => question.id !== id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingQuestionId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingQuestionId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setQuestions((prev) => {
      const from = prev.findIndex((q) => q.id === active.id)
      const to = prev.findIndex((q) => q.id === over.id)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const isOnce = cadence === STANDUP_CADENCES.Once

  const timesValid = startTime < endTime

  const canSubmit =
    name.trim().length > 0 &&
    selectedTeamId !== null &&
    (isOnce || scheduleDays.length > 0) &&
    timesValid &&
    questions.length > 0 &&
    questions.every((question) => question.prompt.trim().length > 0) &&
    !createStandupMutation.isPending

  const handleSubmit = () => {
    if (!selectedTeamId) return
    const payload: CreateStandupInput = {
      name: name.trim(),
      teamId: selectedTeamId,
      cadence,
      scheduleDays: isOnce ? [] : scheduleDays,
      startTime,
      endTime,
      questions: questions.map((question) => ({
        prompt: question.prompt.trim(),
        color: question.color,
        isRequired: question.isRequired,
      })),
    }
    createStandupMutation.mutate(payload)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/standups">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to standups</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarCheck className="h-7 w-7 text-primary" />
            New Standup
          </h1>
          <p className="text-muted-foreground">
            Custom questions and a schedule that fits your team
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Standup details</CardTitle>
          <CardDescription>Name the standup and pick a team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="standup-name">Standup name</Label>
            <Input
              id="standup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Daily Standup"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Select
              value={selectedTeamId ?? undefined}
              onValueChange={setSelectedTeamId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {(teamsData?.teams ?? []).map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            When should your team submit updates? The room for each day is
            always available — the schedule just sets expectations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                      'rounded-full border px-4 py-1.5 text-sm transition-colors',
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

          {isOnce ? (
            <p className="text-sm text-muted-foreground">
              A one-time standup runs for today only — perfect for an ad-hoc
              check-in without a recurring schedule.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'w-14 rounded-md border px-0 py-1.5 text-center text-sm transition-colors',
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
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Start</span>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-36"
                />
              </div>
              <span className="mt-5 text-muted-foreground">–</span>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">End</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="w-36"
                />
              </div>
            </div>
            {!timesValid && (
              <p className="text-xs text-destructive">
                End time must be after start time.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>
            Go beyond the standard format — ask what matters to your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext
            sensors={dndSensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-4">
              {questions.map((question) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  isDragging={draggingQuestionId === question.id}
                  canRemove={questions.length > 1}
                  onUpdate={updateQuestion}
                  onRemove={removeQuestion}
                />
              ))}
            </div>
            <DragOverlay>
              {draggingQuestionId && (
                <div className="rounded-lg border-2 border-primary bg-background px-3 py-2.5 text-sm text-muted-foreground shadow-xl">
                  {questions.find((q) => q.id === draggingQuestionId)?.prompt ||
                    'Question'}
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <Button
            variant="outline"
            size="sm"
            onClick={addQuestion}
            disabled={questions.length >= 10}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        <Button asChild variant="outline">
          <Link to="/standups">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {createStandupMutation.isPending ? 'Creating…' : 'Create standup'}
        </Button>
      </div>
    </div>
  )
}

// ─── SortableQuestionRow ────────────────────────────────────────────────────
// A question row that is both draggable and droppable so questions can be
// reordered. Drag listeners are attached to the grip handle only, leaving the
// prompt input, color swatches, and remove button fully interactive.
function SortableQuestionRow({
  question,
  isDragging,
  canRemove,
  onUpdate,
  onRemove,
}: {
  question: QuestionDraft
  isDragging: boolean
  canRemove: boolean
  onUpdate: (id: string, patch: Partial<QuestionDraft>) => void
  onRemove: (id: string) => void
}) {
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
  } = useDraggable({
    id: question.id,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: question.id })

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRef}
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3',
        isDragging && 'opacity-40',
        isOver && 'ring-2 ring-primary ring-offset-1',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: question.color }}
    >
      <button
        type="button"
        className="mt-1.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
        <span className="sr-only">Drag to reorder question</span>
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={question.prompt}
          onChange={(event) =>
            onUpdate(question.id, { prompt: event.target.value })
          }
          placeholder="What did you complete yesterday?"
          maxLength={500}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={question.isRequired}
              onCheckedChange={(checked) =>
                onUpdate(question.id, { isRequired: checked === true })
              }
            />
            Required
          </label>
          <div className="flex items-center gap-1.5">
            {QUESTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate(question.id, { color })}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform',
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
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(question.id)}
        disabled={!canRemove}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Remove question</span>
      </Button>
    </div>
  )
}
