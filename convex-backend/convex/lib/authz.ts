import { ConvexError } from 'convex/values'
import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server'
import type { DataModel } from '../_generated/dataModel'

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>

/**
 * Resolve the authenticated caller, rejecting unauthenticated requests.
 *
 * `identity.subject` is the Better Auth user id (the JWT `sub`), which equals the
 * `userId` stored in our projection rows — so per-user authorization compares on
 * `subject`. Do NOT switch to `identity.tokenIdentifier`: it is `sub`+`iss` and
 * would never match the bare user id we persist.
 */
export async function requireIdentity(ctx: Ctx): Promise<{
  subject: string
  role?: string
}> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthenticated')
  }
  return identity as { subject: string; role?: string }
}

// System-admin role values that bypass team-membership scoping (they can see
// every team's data). Accepts the Better Auth admin-plugin value (`admin`) and
// the project's own system-role enum values, so the check is robust to whichever
// the JWT actually carries. Keep in sync with USER_ROLES in the API.
const ADMIN_ROLES = new Set(['admin', 'super-admin', 'system-admin'])

export function isAdminRole(role?: string): boolean {
  return role !== undefined && ADMIN_ROLES.has(role)
}

/**
 * Resolve the set of team IDs the caller belongs to, from the `liveTeamMembers`
 * projection NestJS pushes after each membership mutation. Team-scoped read
 * queries filter their results to this set so an authenticated caller only sees
 * data for teams they are actually a member of (closing the cross-tenant read
 * gap — SECURITY-ASSESSMENT F1). Bounded by how many teams one user joins.
 */
export async function getCallerTeamIds(
  ctx: Ctx,
  subject: string,
): Promise<Set<string>> {
  const rows = await ctx.db
    .query('liveTeamMembers')
    .withIndex('by_user_id', (q) => q.eq('userId', subject))
    .collect()

  return new Set(rows.map((row) => row.teamId))
}

/**
 * Assert the caller may read a specific team's data: either a system admin, or a
 * member of that team. Throws `ConvexError('Forbidden')` otherwise. Used by
 * team-keyed queries that take a client-supplied `teamId` (e.g. team stats).
 */
export async function assertTeamMembership(
  ctx: Ctx,
  identity: { subject: string; role?: string },
  teamId: string,
): Promise<void> {
  if (isAdminRole(identity.role)) {
    return
  }

  // Query the composite index by its `teamId` prefix, then match the caller in
  // JS — the `./server` wrappers are schema-generic so a chained `.eq().eq()`
  // isn't typed here, and a team's membership list is bounded.
  const membership = (
    await ctx.db
      .query('liveTeamMembers')
      .withIndex('by_team_user', (q) => q.eq('teamId', teamId))
      .collect()
  ).find((row) => row.userId === identity.subject)

  if (!membership) {
    throw new ConvexError('Forbidden')
  }
}
