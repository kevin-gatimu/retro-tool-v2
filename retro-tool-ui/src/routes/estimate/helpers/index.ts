/**
 * Estimate route helper functions
 */
import type { EstimateSession } from '@/common/types/estimates'
import type { VoteOption } from '../types'

/**
 * Fallback point scale used when a session has no template attached.
 */
export const DEFAULT_POINT_VALUES: VoteOption[] = [
  { label: '0', value: '0', color: null },
  { label: '½', value: '0.5', color: null },
  { label: '1', value: '1', color: null },
  { label: '2', value: '2', color: null },
  { label: '3', value: '3', color: null },
  { label: '5', value: '5', color: null },
  { label: '8', value: '8', color: null },
  { label: '13', value: '13', color: null },
  { label: '20', value: '20', color: null },
  { label: '40', value: '40', color: null },
  { label: '100', value: '100', color: null },
  { label: '?', value: '?', color: null },
  { label: '☕', value: '☕', color: null },
]

/**
 * Format a raw stored point value into a display string, mapping it to its
 * template label when one exists (e.g. `"5"` → `"M (5)"`).
 */
export function formatTemplatePoint(
  value: string | number | null,
  template: EstimateSession['template'],
): string {
  if (value === null) return '—'
  const strValue = String(value)
  if (!template) return strValue
  const found = template.values.find((v) => v.value === strValue)
  if (!found || found.label === strValue) return strValue
  return `${found.label} (${strValue})`
}

/**
 * Find the template label whose numeric value sits closest to `avg` — used to
 * annotate a computed average with the nearest scale point.
 */
export function closestTemplateLabel(
  avg: number,
  template: EstimateSession['template'],
): string | null {
  if (!template) return null
  const numeric = template.values
    .map((v) => ({ label: v.label, n: parseFloat(v.value) }))
    .filter((v) => !isNaN(v.n))
    .sort((a, b) => Math.abs(a.n - avg) - Math.abs(b.n - avg))
  return numeric[0]?.label ?? null
}

/**
 * Format seconds to mm:ss format
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * Calculate round duration for a round object
 */
export function getRoundDurationLabel(round: {
  createdAt: string | Date
  revealedAt?: string | Date | null
  updatedAt?: string | Date | null
  status: string
}): string | null {
  const startedAt = parseDate(round.createdAt)
  const revealedAt = parseDate(round.revealedAt)
  const updatedAt = parseDate(round.updatedAt)
  if (!startedAt) return null

  const endedAt = revealedAt ?? (round.status !== 'active' ? updatedAt : null)
  if (!endedAt || endedAt <= startedAt) return null
  return formatDuration(endedAt.getTime() - startedAt.getTime())
}

/**
 * Parse date with NaN checks
 */
export function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const parsed = new Date(date)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Calculate vote statistics (average, min, max) with filtering
 */
export function getVoteStats(votes: (number | string)[] | undefined): {
  average: number
  min: number
  max: number
} {
  if (!votes || votes.length === 0) {
    return { average: 0, min: 0, max: 0 }
  }

  const numericVotes = votes
    .map((v) => {
      const num = typeof v === 'string' ? parseInt(v, 10) : v
      return isNaN(num) ? null : num
    })
    .filter((v): v is number => v !== null)

  if (numericVotes.length === 0) {
    return { average: 0, min: 0, max: 0 }
  }

  const sum = numericVotes.reduce((a, b) => a + b, 0)
  return {
    average: Math.round((sum / numericVotes.length) * 10) / 10,
    min: Math.min(...numericVotes),
    max: Math.max(...numericVotes),
  }
}

/**
 * Validate URL format (http/https)
 */
export function isValidUrl(url: string): boolean {
  if (!url.trim()) return true // empty is allowed
  return /^https?:\/\//.test(url.trim())
}

/**
 * Compute average / min / max for a session's revealed votes. Returns `null`
 * unless the session is `revealed` and at least one numeric vote exists.
 */
export function getRevealedVoteStats(
  session: EstimateSession,
): { avg: string; min: number; max: number } | null {
  if (session.status !== 'revealed') return null

  const numericVotes = session.votes
    .map((v) => {
      if (v.points === '½') return 0.5
      const num = Number.parseFloat(v.points)
      return Number.isNaN(num) ? null : num
    })
    .filter((v): v is number => v !== null)

  if (numericVotes.length === 0) return null

  const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
  const sorted = [...numericVotes].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  return { avg: avg.toFixed(1), min, max }
}
