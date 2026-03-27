/**
 * Retros route helper functions and constants
 */

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
