/**
 * Retros route helper functions and constants
 */

/**
 * Format a duration in seconds as `m:ss` (e.g. 65 → "1:05").
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Badge variant for a retro status shown in the header.
 */
export function getStatusColor(
  status: string,
): 'secondary' | 'outline' | 'default' {
  switch (status) {
    case 'draft':
      return 'secondary'
    case 'completed':
      return 'outline'
    default:
      return 'default'
  }
}

/**
 * Human-readable label for a retro status.
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Not Started'
    case 'active':
      return 'Adding Cards'
    case 'voting':
      return 'Voting'
    case 'grouping':
      return 'Grouping'
    case 'discussing':
      return 'Discussing'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

/**
 * Initials for an avatar fallback, derived from a display name.
 */
export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Check if user can proceed to next wizard step based on current step and selected values
 */
export function canProceed(
  step: string,
  selectedTemplateId: string | null,
  selectedTeamId: string | null,
): boolean {
  switch (step) {
    case 'template':
      return !!selectedTemplateId
    case 'team':
      return !!selectedTeamId
    case 'settings':
      return true
    case 'confirm':
      return true
    default:
      return false
  }
}

/**
 * Parse and validate URL search parameters
 */
export function validateSearchParams(
  status?: string,
  redirect?: string,
): { status?: string; redirect?: string } {
  return {
    status: status ? String(status) : undefined,
    redirect: typeof redirect === 'string' ? redirect : undefined,
  }
}
