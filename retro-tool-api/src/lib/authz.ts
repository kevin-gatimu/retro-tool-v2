import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as authSchema from '../auth/schema';
import * as teamSchema from '../teams/schema';
import { USER_ROLES } from '../common/enums';

/**
 * Any Drizzle connection that carries at least the auth + team schemas. The
 * feature services inject wider schema unions; this shape is the minimal subset
 * these helpers read, so every caller's database satisfies it structurally.
 */
type AuthzDatabase = NodePgDatabase<
  typeof authSchema & typeof teamSchema & Record<string, unknown>
>;

/**
 * Resolve which team IDs a user is allowed to see across the collaboration
 * features (retros, estimates, icebreakers, …).
 *
 * - Super/system admins see everything → returns `null`, the "no team filter"
 *   sentinel used by the paginated history queries. Callers translate `null`
 *   into "omit the `inArray(teamId, …)` condition".
 * - Everyone else is scoped to their team memberships → returns the (possibly
 *   empty) list of team IDs. An empty array means the user is in no teams and
 *   therefore can see nothing; callers should short-circuit to an empty result.
 *
 * This centralizes the membership-resolution that was previously inlined in
 * each feature's `getHistory`; the count endpoints consume it directly.
 */
export async function resolveAllowedTeamIds(
  db: AuthzDatabase,
  userId: string,
): Promise<string[] | null> {
  const [fullUser] = await db
    .select({ role: authSchema.user.role })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId))
    .limit(1);

  if (
    fullUser?.role === USER_ROLES.SuperAdmin ||
    fullUser?.role === USER_ROLES.SystemAdmin
  ) {
    return null;
  }

  const memberships = await db
    .select({ teamId: teamSchema.teamMember.teamId })
    .from(teamSchema.teamMember)
    .where(eq(teamSchema.teamMember.userId, userId));

  return memberships.map((m) => m.teamId);
}
