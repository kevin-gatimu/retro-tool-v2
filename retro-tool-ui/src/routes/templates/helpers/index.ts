import type { Organization } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'

/**
 * Resolve which organizations a user may create an estimate template under.
 *
 * - System admins: all organizations.
 * - Org owners/admins: the organizations they administer.
 * - Team leads (with no org-admin role): organizations where they lead a team.
 * - Otherwise: none.
 */
export function resolveEligibleOrgs({
  sysAdmin,
  adminOrgs,
  isTeamLead,
  allOrgs,
  teams,
}: {
  sysAdmin: boolean
  adminOrgs: Organization[]
  isTeamLead: boolean
  allOrgs: Organization[]
  teams: Team[]
}): Organization[] {
  if (sysAdmin) return allOrgs
  if (adminOrgs.length > 0) return adminOrgs
  if (isTeamLead) {
    return allOrgs.filter((o) =>
      teams.some((t) => t.organizationId === o.id && t.myRole === 'team-lead'),
    )
  }
  return []
}
