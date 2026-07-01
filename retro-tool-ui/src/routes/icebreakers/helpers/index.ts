import {
  ICEBREAKER_FLAVOURS,
  ICEBREAKER_SESSION_STATUSES,
} from '@/common/enums/icebreaker.enums'
import type {
  TIcebreakerFlavour,
  TIcebreakerSessionStatus,
} from '@/common/enums/icebreaker.enums'

export const FLAVOUR_LABELS: Record<TIcebreakerFlavour, string> = {
  [ICEBREAKER_FLAVOURS.Fun]: 'Fun',
  [ICEBREAKER_FLAVOURS.Professional]: 'Professional',
  [ICEBREAKER_FLAVOURS.Creative]: 'Creative',
}

export const FLAVOUR_ACCENTS: Record<TIcebreakerFlavour, string> = {
  [ICEBREAKER_FLAVOURS.Fun]:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  [ICEBREAKER_FLAVOURS.Professional]:
    'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  [ICEBREAKER_FLAVOURS.Creative]:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
}

export const STATUS_LABELS: Record<TIcebreakerSessionStatus, string> = {
  [ICEBREAKER_SESSION_STATUSES.Waiting]: 'Waiting',
  [ICEBREAKER_SESSION_STATUSES.Curating]: 'Curating',
  [ICEBREAKER_SESSION_STATUSES.Presenting]: 'On screen',
  [ICEBREAKER_SESSION_STATUSES.Completed]: 'Completed',
}

export const ALL_FLAVOURS: TIcebreakerFlavour[] = [
  ICEBREAKER_FLAVOURS.Fun,
  ICEBREAKER_FLAVOURS.Professional,
  ICEBREAKER_FLAVOURS.Creative,
]

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
 * Default icebreaker session name from the current local time, e.g.
 * "Monday 9th March - 8pm" / "Tuesday 3rd June - 2:30pm". Used to pre-fill the
 * create form so a host can start a standup session without typing a name.
 */
export function defaultSessionName(now: Date = new Date()): string {
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

  return `${weekday} ${day} ${month} - ${time}`
}
