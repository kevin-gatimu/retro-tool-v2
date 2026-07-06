import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { StandupSummary } from '@/common/types/standups'
import {
  formatTime,
  formatTimeRange,
  shiftDate,
  standupsScheduledOn,
  timeToMinutes,
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

interface StandupCalendarProps {
  standups: StandupSummary[]
  /** Keys of `${standupId}:${date}` for days that actually have submissions. */
  activity: Set<string>
  month: number
  year: number
  selectedDate: string
  onMonthChange: (month: number, year: number) => void
  onSelectDate: (date: string) => void
  /** Open a specific standup room for the given day. */
  onOpenRoom: (standupId: string, date: string) => void
}

type DayCell = {
  date: string
  dayOfMonth: number
  inMonth: boolean
  scheduled: { standup: StandupSummary; isOngoing: boolean }[]
}

export function StandupCalendar({
  standups,
  activity,
  month,
  year,
  selectedDate,
  onMonthChange,
  onSelectDate,
  onOpenRoom,
}: StandupCalendarProps) {
  const today = todayDateString()
  // Which day's room popover is open (by date string), if any.
  const [openCell, setOpenCell] = useState<string | null>(null)
  const [view, setView] = useState<'month' | 'day'>('month')

  const weeks = useMemo<DayCell[][]>(() => {
    const firstOfMonth = new Date(year, month, 1)
    // Monday-first grid: back up to the Monday on/before the 1st.
    const gridStart = new Date(firstOfMonth)
    const dow = gridStart.getDay()
    gridStart.setDate(gridStart.getDate() - (dow === 0 ? 6 : dow - 1))

    const cells: DayCell[] = []
    const cursor = new Date(gridStart)
    // 6 rows always — keeps the grid height stable across months.
    for (let i = 0; i < 42; i += 1) {
      const dateStr = toDateString(cursor)
      const scheduled = standupsScheduledOn(
        standups,
        dateStr,
        activity,
        today,
      ).map((standup) => ({
        standup,
        isOngoing: standup.isActive && dateStr >= today,
      }))

      cells.push({
        date: dateStr,
        dayOfMonth: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        scheduled,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    const grouped: DayCell[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7))
    }
    return grouped
  }, [standups, activity, month, year, today])

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    onMonthChange(next.getMonth(), next.getFullYear())
  }

  // Year picker: a window around the current year plus any standup creation years.
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const years = new Set<number>([year, current])
    for (const standup of standups) {
      years.add(new Date(standup.createdAt).getFullYear())
    }
    for (let y = current - 3; y <= current + 1; y += 1) years.add(y)
    return [...years].sort((a, b) => a - b)
  }, [standups, year])

  return (
    <div className="rounded-xl border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
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
          <Button
            variant="outline"
            size="sm"
            className="ml-1 h-8"
            onClick={() => {
              const now = new Date()
              onMonthChange(now.getMonth(), now.getFullYear())
              onSelectDate(today)
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onValueChange={(value) => onMonthChange(Number(value), year)}
          >
            <SelectTrigger className="h-8 w-36">
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
            onValueChange={(value) => onMonthChange(month, Number(value))}
          >
            <SelectTrigger className="h-8 w-24">
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

        <div className="flex items-center gap-4">
          {/* Month / Day toggle */}
          <div className="flex items-center rounded-md border p-0.5">
            {(['month', 'day'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                  view === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Ongoing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Closed
            </span>
          </div>
        </div>
      </div>

      {view === 'day' ? (
        <StandupDayView
          standups={standups}
          activity={activity}
          selectedDate={selectedDate}
          today={today}
          onSelectDate={onSelectDate}
          onOpenRoom={onOpenRoom}
        />
      ) : (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b text-center">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="py-2 text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {weeks.flat().map((cell) => {
              const isToday = cell.date === today
              const isSelected = cell.date === selectedDate
              const hasRooms = cell.scheduled.length > 0
              const dayButton = (
                <button
                  type="button"
                  onClick={() => {
                    onSelectDate(cell.date)
                    // Days with rooms open the picker popover; empty days just
                    // select (the popover has no trigger content to show).
                    if (hasRooms) setOpenCell(cell.date)
                  }}
                  className={cn(
                    'relative flex min-h-16 w-full flex-col items-center gap-1 border-b border-r p-1.5 pt-2 transition-colors last:border-r-0 hover:bg-accent sm:min-h-20',
                    !cell.inMonth && 'bg-muted/30 text-muted-foreground/50',
                    isSelected && 'bg-primary/10 hover:bg-primary/15',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      isToday &&
                        'bg-primary font-semibold text-primary-foreground',
                      isSelected && !isToday && 'font-semibold text-primary',
                    )}
                  >
                    {cell.dayOfMonth}
                  </span>
                  {hasRooms && (
                    <span className="flex flex-wrap items-center justify-center gap-1">
                      {cell.scheduled
                        .slice(0, 4)
                        .map(({ standup, isOngoing }) => (
                          <span
                            key={standup.id}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              isOngoing
                                ? 'animate-pulse bg-emerald-500'
                                : 'bg-muted-foreground/40',
                            )}
                          />
                        ))}
                      {cell.scheduled.length > 4 && (
                        <span className="text-[9px] leading-none text-muted-foreground">
                          +{cell.scheduled.length - 4}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              )

              if (!hasRooms) {
                return <div key={cell.date}>{dayButton}</div>
              }

              return (
                <Popover
                  key={cell.date}
                  open={openCell === cell.date}
                  onOpenChange={(open) => setOpenCell(open ? cell.date : null)}
                >
                  <PopoverTrigger asChild>{dayButton}</PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="center"
                    className="w-80 p-2"
                  >
                    <p className="px-2 py-1.5 text-sm font-medium">
                      {new Date(`${cell.date}T00:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: 'long', day: 'numeric', month: 'long' },
                      )}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {cell.scheduled.map(({ standup, isOngoing }) => (
                        <button
                          key={standup.id}
                          type="button"
                          onClick={() => {
                            setOpenCell(null)
                            onOpenRoom(standup.id, cell.date)
                          }}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <span
                            className={cn(
                              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                              isOngoing
                                ? 'animate-pulse bg-emerald-500'
                                : 'bg-muted-foreground/40',
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium leading-snug">
                              {standup.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {standup.team.emoji
                                ? `${standup.team.emoji} `
                                : ''}
                              {standup.team.name}
                              {formatTimeRange(
                                standup.startTime,
                                standup.endTime,
                              ) &&
                                ` · ${formatTimeRange(standup.startTime, standup.endTime)}`}
                            </span>
                          </span>
                          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Day view ───────────────────────────────────────────────────────────────
// A Google-Calendar-style single-day time column: hour rows, each scheduled
// standup drawn as a block at its time, a live "now" line on today, and an
// "Unscheduled" fallback list for standups without a set time.
const DAY_START_HOUR = 6 // 6am
const DAY_END_HOUR = 22 // 10pm
const HOUR_PX = 64
// Short events (e.g. 30 min) would be too thin for both text lines, so blocks
// never render shorter than this — enough for the name + time/team line.
const MIN_BLOCK_PX = 46
const DAY_START_MIN = DAY_START_HOUR * 60
const DAY_TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60
const PX_PER_MIN = HOUR_PX / 60

function StandupDayView({
  standups,
  activity,
  selectedDate,
  today,
  onSelectDate,
  onOpenRoom,
}: {
  standups: StandupSummary[]
  activity: Set<string>
  selectedDate: string
  today: string
  onSelectDate: (date: string) => void
  onOpenRoom: (standupId: string, date: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Live "now" position, refreshed each minute. Only shown when viewing today.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const scheduled = standupsScheduledOn(standups, selectedDate, activity, today)
  const timed = scheduled.filter((s) => s.startTime && s.endTime)
  const unscheduled = scheduled.filter((s) => !s.startTime || !s.endTime)

  const isToday = selectedDate === today
  const nowTop = (nowMinutes - DAY_START_MIN) * PX_PER_MIN
  const nowInWindow = isToday && nowMinutes >= DAY_START_MIN

  // Scroll the now-line (or the first standup) into view on mount / day change.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const target = nowInWindow
      ? nowTop
      : timed.length > 0
        ? (timeToMinutes(timed[0].startTime as string) - DAY_START_MIN) *
          PX_PER_MIN
        : 0
    container.scrollTo({ top: Math.max(0, target - 80), behavior: 'smooth' })
  }, [selectedDate, nowInWindow, nowTop, timed])

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i,
  )

  return (
    <div>
      {/* Day nav */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous day</span>
        </Button>
        <p className="text-sm font-medium">
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          {isToday && (
            <span className="ml-2 text-xs font-normal text-primary">Today</span>
          )}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next day</span>
        </Button>
      </div>

      {/* Unscheduled fallback */}
      {unscheduled.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            No set time:
          </span>
          {unscheduled.map((standup) => (
            <button
              key={standup.id}
              type="button"
              onClick={() => onOpenRoom(standup.id, selectedDate)}
              className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-accent"
            >
              {standup.team.emoji ? `${standup.team.emoji} ` : ''}
              {standup.name}
            </button>
          ))}
        </div>
      )}

      {/* Time column */}
      <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto">
        <div
          className="relative"
          style={{ height: DAY_TOTAL_MIN * PX_PER_MIN }}
        >
          {/* Hour grid lines + labels */}
          {hours.map((hour) => {
            const top = (hour * 60 - DAY_START_MIN) * PX_PER_MIN
            const label = formatTime(`${String(hour).padStart(2, '0')}:00`)
            return (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border/60"
                style={{ top }}
              >
                <span className="absolute -top-2 left-2 bg-card px-1 text-[10px] text-muted-foreground">
                  {label}
                </span>
              </div>
            )
          })}

          {/* Standup blocks */}
          {timed.map(({ startTime, endTime, ...standup }) => {
            const startMin = timeToMinutes(startTime as string)
            const endMin = timeToMinutes(endTime as string)
            const top = (startMin - DAY_START_MIN) * PX_PER_MIN
            const height = Math.max(
              MIN_BLOCK_PX,
              (endMin - startMin) * PX_PER_MIN,
            )
            const isOngoing = standup.isActive && selectedDate >= today
            return (
              <button
                key={standup.id}
                type="button"
                onClick={() => onOpenRoom(standup.id, selectedDate)}
                className={cn(
                  'absolute left-16 right-3 flex flex-col justify-center gap-0.5 overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight transition-colors',
                  isOngoing
                    ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : 'border-border bg-muted hover:bg-accent',
                )}
                style={{ top, height }}
              >
                <span className="truncate font-medium">{standup.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {formatTimeRange(startTime, endTime)} ·{' '}
                  {standup.team.emoji ? `${standup.team.emoji} ` : ''}
                  {standup.team.name}
                </span>
              </button>
            )
          })}

          {/* Now line */}
          {nowInWindow && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
              style={{ top: nowTop }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <span className="h-px flex-1 bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
