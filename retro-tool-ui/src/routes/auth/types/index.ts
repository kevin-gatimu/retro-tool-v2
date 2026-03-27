/**
 * Auth route type definitions
 */

import type { TUserStatus } from '@/common/enums/user.enums'

// ─────────────────────────────────────────────────────────────────────────────
// sign-in.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type SignInSearch = {
  status?: Extract<TUserStatus, 'pending' | 'rejected'>
  redirect?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// reset-password.tsx types
// ─────────────────────────────────────────────────────────────────────────────

export type PasswordRequirement = {
  label: string
  met: boolean
}
