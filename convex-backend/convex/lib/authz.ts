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
