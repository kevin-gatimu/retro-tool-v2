/**
 * Estimate route helper functions
 */

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
