import { STANDUP_SCHEDULE_DAYS } from '@/common/enums/standup.enums'
import type {
  TStandupCadence,
  TStandupScheduleDay,
} from '@/common/enums/standup.enums'

export const CADENCE_LABELS: Record<TStandupCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
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
