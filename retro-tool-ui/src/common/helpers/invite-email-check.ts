/**
 * Shared display helpers for the "check invite email" hint shown under the
 * invite-by-email field on the organization and team detail pages. Both pages
 * render the same three states (already a member / registered / not registered),
 * so the color class and message live here instead of as nested ternaries in
 * each route.
 */

export interface InviteEmailCheck {
  registered: boolean
  name?: string
  isMember?: boolean
}

/** Tailwind text-color class for the hint, by check state. */
export function inviteEmailCheckColorClass(check: InviteEmailCheck): string {
  if (check.isMember) return 'text-destructive'
  if (check.registered) return 'text-emerald-400'
  return 'text-gray-400'
}

/**
 * Hint message for the check state. `memberScope` names the container in the
 * "already a member" message ("organisation" or "team").
 */
export function inviteEmailCheckMessage(
  check: InviteEmailCheck,
  memberScope: 'organisation' | 'team',
): string {
  if (check.isMember) {
    return `This user is already a member of this ${memberScope}`
  }
  if (check.registered) {
    const namePart = check.name ? ` (${check.name})` : ''
    return `Account found${namePart} — invitation email will be sent`
  }
  return 'No account found — invitation email will be sent to register'
}
