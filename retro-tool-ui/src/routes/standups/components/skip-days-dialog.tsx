import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { STANDUPS_ENDPOINTS } from '@/lib/api-endpoints'
import { cn } from '@/lib/utils'
import type { StandupDetail } from '@/common/types/standups'
import { useStandupSkipMutations } from '../hooks/use-standup-mutations'
import {
  formatEntryDate,
  isStandupScheduledOn,
  scheduleDaysLabel,
  toDateString,
  todayDateString,
} from '../helpers'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface SkipDaysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  standup: StandupDetail
  standupId: string
}

type DayCell = {
  date: string
  dayOfMonth: number
  inMonth: boolean
  scheduled: boolean
  skipped: boolean
  isPast: boolean
  hasSubmissions: boolean
}

/**
 * Manager-only calendar for adding/removing skipped days on a single standup.
 * Only scheduled days from today onward are toggleable; past days are shown
 * read-only. Days that already have submissions warn before being skipped.
 * Each toggle is a single-date skip/unskip call (see useStandupSkipMutations).
 */
export function SkipDaysDialog({
  open,
  onOpenChange,
  standup,
  standupId,
}: SkipDaysDialogProps) {
  const today = todayDateString()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  // Pending "skip a day that has updates" confirmation.
  const [confirmDate, setConfirmDate] = useState<string | null>(null)

  const { setSkipMutation } = useStandupSkipMutations(standupId)

  // Own the skipped-day list from a stable query (not the viewed entry) so
  // toggles reflect live in the calendar. Seed from the passed-in standup.
  const { data: detail } = useQuery({
    queryKey: ['standup', standupId],
    queryFn: () => api.get<StandupDetail>(STANDUPS_ENDPOINTS.BY_ID(standupId)),
    enabled: open,
    initialData: standup,
    staleTime: 30_000,
  })
  const skippedDays = detail.skippedDays
  const skippedSet = useMemo(() => new Set(skippedDays), [skippedDays])

  // Submission activity for the visible grid, to flag days with updates.
  const gridStart = toDateString(new Date(year, month, -6))
  const gridEnd = toDateString(new Date(year, month + 1, 13))
  const { data: activityRows } = useQuery({
    queryKey: ['standup-activity', gridStart, gridEnd],
    queryFn: () =>
      api.get<
        { standupId: string; entryDate: string; submissionCount: number }[]
      >(STANDUPS_ENDPOINTS.ACTIVITY(gridStart, gridEnd)),
    enabled: open,
    staleTime: 30_000,
  })
  const submittedDates = useMemo(
    () =>
      new Set(
        (activityRows ?? [])
          .filter((row) => row.standupId === standupId)
          .map((row) => row.entryDate),
      ),
    [activityRows, standupId],
  )

  const weeks = useMemo<DayCell[][]>(() => {
    const firstOfMonth = new Date(year, month, 1)
    const gridStartDate = new Date(firstOfMonth)
    const dow = gridStartDate.getDay()
    gridStartDate.setDate(gridStartDate.getDate() - (dow === 0 ? 6 : dow - 1))

    const cells: DayCell[] = []
    const cursor = new Date(gridStartDate)
    for (let i = 0; i < 42; i += 1) {
      const dateStr = toDateString(cursor)
      cells.push({
        date: dateStr,
        dayOfMonth: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        scheduled: isStandupScheduledOn(standup, dateStr),
        skipped: skippedSet.has(dateStr),
        isPast: dateStr < today,
        hasSubmissions: submittedDates.has(dateStr),
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    const grouped: DayCell[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7))
    }
    return grouped
  }, [standup, skippedSet, submittedDates, month, year, today])

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setMonth(next.getMonth())
    setYear(next.getFullYear())
  }

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const years = new Set<number>([year, current])
    years.add(new Date(standup.createdAt).getFullYear())
    for (let y = current - 1; y <= current + 2; y += 1) years.add(y)
    return [...years].sort((a, b) => a - b)
  }, [standup.createdAt, year])

  const toggle = (cell: DayCell) => {
    // Only scheduled, today-or-future days are editable.
    if (!cell.scheduled || cell.isPast) return
    if (!cell.skipped && cell.hasSubmissions) {
      // Warn before skipping a day that already has updates.
      setConfirmDate(cell.date)
      return
    }
    setSkipMutation.mutate({ date: cell.date, skip: !cell.skipped })
  }

  const upcomingSkipped = useMemo(
    () => [...skippedDays].filter((d) => d >= today).sort(),
    [skippedDays, today],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage skipped days</DialogTitle>
            <DialogDescription>
              Skip scheduled days when the team is off. Runs on{' '}
              {scheduleDaysLabel(standup.scheduleDays)}. Click a scheduled day
              to skip or restore it.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous month</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next month</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(month)}
                onValueChange={(value) => setMonth(Number(value))}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(year)}
                onValueChange={(value) => setYear(Number(value))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_HEADERS.map((header) => (
              <div
                key={header}
                className="py-1 text-xs font-medium text-muted-foreground"
              >
                {header}
              </div>
            ))}
            {weeks.flat().map((cell) => {
              const editable = cell.scheduled && !cell.isPast
              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={!editable || setSkipMutation.isPending}
                  onClick={() => toggle(cell)}
                  aria-label={`${formatEntryDate(cell.date)}${
                    cell.skipped ? ' (skipped)' : ''
                  }`}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-md text-sm transition-colors',
                    !cell.inMonth && 'opacity-40',
                    cell.date === today && 'ring-1 ring-primary',
                    editable && 'cursor-pointer hover:bg-accent',
                    !editable && 'cursor-default',
                    cell.skipped &&
                      'bg-amber-500/15 text-amber-600 line-through dark:text-amber-400',
                    !cell.skipped &&
                      cell.scheduled &&
                      !cell.isPast &&
                      'font-medium',
                    !cell.scheduled && 'text-muted-foreground',
                  )}
                >
                  {cell.dayOfMonth}
                  {/* Scheduled marker (only for non-skipped scheduled days) */}
                  {cell.scheduled && !cell.skipped && (
                    <span
                      className={cn(
                        'absolute bottom-1 h-1 w-1 rounded-full',
                        cell.isPast
                          ? 'bg-muted-foreground/40'
                          : 'bg-emerald-500',
                      )}
                    />
                  )}
                  {/* Has-updates marker */}
                  {cell.hasSubmissions && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-500/40" />
              Skipped
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Has updates
            </span>
          </div>

          {/* Upcoming skipped summary */}
          {upcomingSkipped.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Upcoming skipped days
              </p>
              <ul className="flex flex-wrap gap-2">
                {upcomingSkipped.map((date) => (
                  <li key={date}>
                    <button
                      type="button"
                      disabled={setSkipMutation.isPending}
                      onClick={() =>
                        setSkipMutation.mutate({ date, skip: false })
                      }
                      className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                    >
                      {formatEntryDate(date)}
                      <span aria-hidden>×</span>
                      <span className="sr-only">Restore {date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDate !== null}
        onOpenChange={(o) => !o && setConfirmDate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip a day with updates?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDate ? formatEntryDate(confirmDate) : 'This day'} already
              has submitted updates. Skipping marks it as a non-standup day; the
              existing updates are kept and stay viewable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDate(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDate) {
                  setSkipMutation.mutate({ date: confirmDate, skip: true })
                }
                setConfirmDate(null)
              }}
            >
              Skip anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
