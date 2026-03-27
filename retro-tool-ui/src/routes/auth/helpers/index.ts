/**
 * Auth route helper functions
 */

import type { PasswordRequirement } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Password validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate password requirement statuses based on password input
 */
export function getPasswordRequirements(
  password: string,
): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
  ]
}

/**
 * Check if two passwords match
 */
export function passwordsMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword && confirmPassword.length > 0
}

/**
 * Check if all password requirements are met
 */
export function allPasswordRequirementsMet(
  requirements: PasswordRequirement[],
): boolean {
  return requirements.every((req) => req.met)
}
