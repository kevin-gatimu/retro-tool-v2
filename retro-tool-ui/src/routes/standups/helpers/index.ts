import { STANDUP_SCHEDULE_DAYS } from '@/common/enums/standup.enums'
import type {
  TStandupCadence,
  TStandupScheduleDay,
} from '@/common/enums/standup.enums'

export const CADENCE_LABELS: Record<TStandupCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  once: 'One-time',
}

export const DAY_OPTIONS: { value: TStandupScheduleDay; label: string }[] = [
  { value: STANDUP_SCHEDULE_DAYS.Monday, label: 'Mon' },
  { value: STANDUP_SCHEDULE_DAYS.Tuesday, label: 'Tue' },
  { value: STANDUP_SCHEDULE_DAYS.Wednesday, label: 'Wed' },
  { value: STANDUP_SCHEDULE_DAYS.Thursday, label: 'Thu' },
  { value: STANDUP_SCHEDULE_DAYS.Friday, label: 'Fri' },
  { value: STANDUP_SCHEDULE_DAYS.Saturday, label: 'Sat' },
  { value: STANDUP_SCHEDULE_DAYS.Sunday, label: 'Sun' },
]

export const QUESTION_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
]

export const DEFAULT_QUESTIONS = [
  { prompt: 'What did you complete yesterday?', color: QUESTION_COLORS[0] },
  { prompt: 'What are you working on today?', color: QUESTION_COLORS[1] },
  { prompt: 'What blockers do you have?', color: QUESTION_COLORS[2] },
]

export const QUICK_REACTIONS = ['👍', '🎉', '🔥', '❤️', '😂', '👀']

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatEntryDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(dateStr: string): string {
  const today = todayDateString()
  if (dateStr === today) return 'Today'
  if (dateStr === shiftDate(today, -1)) return 'Yesterday'
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function scheduleDaysLabel(scheduleDays: string): string {
  const days = scheduleDays.split(',').filter(Boolean)
  if (days.length === 0) return 'One day only'
  if (days.length === 7) return 'Every day'
  if (
    days.length === 5 &&
    ['MON', 'TUE', 'WED', 'THU', 'FRI'].every((d) => days.includes(d))
  ) {
    return 'Weekdays'
  }
  const labels: Record<string, string> = {
    MON: 'Mon',
    TUE: 'Tue',
    WED: 'Wed',
    THU: 'Thu',
    FRI: 'Fri',
    SAT: 'Sat',
    SUN: 'Sun',
  }
  return days.map((d) => labels[d] ?? d).join(', ')
}

/**
 * Client-side mirror of the server's scheduled-day check: does this standup
 * occur on the given local date? Fortnights anchor to the creation week
 * (Monday-based), matching StandupsService.isScheduledDay.
 */
export function isStandupScheduledOn(
  standup: {
    scheduleDays: string
    cadence: string
    createdAt: string | Date
  },
  dateStr: string,
): boolean {
  // One-time standups occur only on the day they were created.
  if (standup.cadence === 'once') {
    return dateStr === toDateString(new Date(standup.createdAt))
  }

  const dayCodes = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const target = new Date(`${dateStr}T00:00:00`)
  const dayCode = dayCodes[target.getDay()]
  const days = standup.scheduleDays.split(',').filter(Boolean)
  if (!days.includes(dayCode)) return false

  if (standup.cadence === 'fortnightly') {
    const startOfIsoWeek = (input: Date) => {
      const d = new Date(input.getFullYear(), input.getMonth(), input.getDate())
      const dow = d.getDay()
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
      return d
    }
    const anchor = startOfIsoWeek(new Date(standup.createdAt))
    const targetWeek = startOfIsoWeek(target)
    const weeks = Math.round(
      (targetWeek.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
    return weeks % 2 === 0
  }

  return true
}

/**
 * Standups that "belong" to a given day, using the same rule as the calendar
 * dots and the selected-day list: today/future shows scheduled standups (or any
 * with submissions); past days only show rooms that actually have submissions.
 * `activity` is the set of `${standupId}:${date}` keys that have submissions.
 */
export function standupsScheduledOn<
  T extends {
    id: string
    createdAt: string | Date
    isActive: boolean
    scheduleDays: string
    cadence: TStandupCadence
    skippedDays: string[]
  },
>(standups: T[], date: string, activity: Set<string>, today: string): T[] {
  return standups.filter((standup) => {
    const created = toDateString(new Date(standup.createdAt))
    if (date < created) return false
    const hasActivity = activity.has(`${standup.id}:${date}`)
    if (standup.skippedDays.includes(date)) return hasActivity
    if (date >= today) {
      return (
        hasActivity || (standup.isActive && isStandupScheduledOn(standup, date))
      )
    }
    return hasActivity
  })
}

/** Local YYYY-MM-DD for an arbitrary Date. */
export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** "HH:MM" for a given minutes-since-midnight value (clamped to a day). */
function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Sensible default start/end for the create form: the next round half-hour and
 * 30 minutes after it, e.g. now 2:12pm → { start: '14:30', end: '15:00' }.
 */
export function defaultStandupTimes(now: Date = new Date()): {
  start: string
  end: string
} {
  const startMinutes =
    Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30
  return {
    start: minutesToTime(startMinutes),
    end: minutesToTime(startMinutes + 30),
  }
}

/** Minutes since midnight for an "HH:MM" time string (0 if malformed). */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** "14:00" → "2:00pm". Returns '' for empty/malformed input. */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  const hours = Number(hStr)
  const minutes = Number(mStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return ''
  const period = hours < 12 ? 'am' : 'pm'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return minutes === 0
    ? `${hour12}${period}`
    : `${hour12}:${minutes.toString().padStart(2, '0')}${period}`
}

/** "14:00","14:30" → "2:00pm – 2:30pm". Returns '' when either is unset. */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = formatTime(start)
  const to = formatTime(end)
  if (!from || !to) return ''
  return `${from} – ${to}`
}

const ORDINAL_RULES = new Intl.PluralRules('en-GB', { type: 'ordinal' })
const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
  zero: 'th',
  many: 'th',
}

function ordinal(day: number): string {
  return `${day}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(day)]}`
}

/**
 * Default standup name from the current local time, e.g.
 * "Standup - Monday 9th March, 8pm". Pre-fills the create form so a lead can
 * set up a standup without typing a name.
 */
export function defaultStandupName(now: Date = new Date()): string {
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = now.toLocaleDateString('en-GB', { month: 'long' })
  const day = ordinal(now.getDate())

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const period = hours < 12 ? 'am' : 'pm'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const time =
    minutes === 0
      ? `${hour12}${period}`
      : `${hour12}:${minutes.toString().padStart(2, '0')}${period}`

  return `Standup - ${weekday} ${day} ${month}, ${time}`
}
