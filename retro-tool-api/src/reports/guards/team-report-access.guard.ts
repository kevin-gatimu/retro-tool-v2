import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as teamSchema from '../../teams/schema';
import * as orgSchema from '../../organizations/schema';
import * as authSchema from '../../auth/schema';
import { isTeamLead } from '../../lib/rbac';
import type { OrgRole, TeamContext, UserRole } from '../../lib/rbac';
import type { ReportsRequestSession } from '../types';

type Database = NodePgDatabase<
  typeof teamSchema & typeof orgSchema & typeof authSchema
>;

/**
 * Grants access to `/reports/v2/teams/:teamId` for team members and the
 * admin cascade (org admin+/system admin+), and attaches
 * `request.reportAccess.isLead` so the controller can shape lead-only fields
 * server-side. Lead status comes from `teamMember.tag` (authoritative per
 * docs/security/authorization-rbac.md) — never from the legacy `user.role` values.
 */
@Injectable()
export class TeamReportAccessGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ReportsRequestSession>();
    const userId = request.session?.user?.id;
    const teamId = request.params.teamId;

    if (!userId) throw new UnauthorizedException();
    if (!teamId) throw new NotFoundException('Team not found');

    const [teamRow] = await this.database
      .select({ organizationId: teamSchema.team.organizationId })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);
    if (!teamRow) throw new NotFoundException('Team not found');

    const [userRow] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);
    if (!userRow) throw new UnauthorizedException();

    const [orgMembership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(
            orgSchema.organizationMember.organizationId,
            teamRow.organizationId,
          ),
        ),
      )
      .limit(1);

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    const ctx: TeamContext = {
      user: { id: userId, role: userRow.role as UserRole },
      orgRole: (orgMembership?.role as OrgRole | undefined) ?? null,
      teamTag: teamMembership?.tag ?? null,
      isSuperAdmin: userRow.role === 'super-admin',
      isSystemAdmin:
        userRow.role === 'super-admin' || userRow.role === 'system-admin',
    };

    const isMember = ctx.teamTag !== null;
    const adminCascade =
      ctx.isSuperAdmin ||
      ctx.isSystemAdmin ||
      ctx.orgRole === 'org-owner' ||
      ctx.orgRole === 'org-admin';

    if (!isMember && !adminCascade) {
      throw new ForbiddenException('Access denied');
    }

    request.reportAccess = { isLead: isTeamLead(ctx) };
    return true;
  }
}
