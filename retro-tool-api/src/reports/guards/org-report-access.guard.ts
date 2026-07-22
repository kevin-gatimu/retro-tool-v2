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
import * as orgSchema from '../../organizations/schema';
import * as authSchema from '../../auth/schema';
import type { ReportsRequestSession } from '../types';

type Database = NodePgDatabase<typeof orgSchema & typeof authSchema>;

/**
 * `/reports/v2/organizations/:orgId` — org-owner/org-admin of the org, or
 * system-admin/super-admin.
 */
@Injectable()
export class OrgReportAccessGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ReportsRequestSession>();
    const userId = request.session?.user?.id;
    const orgId = request.params.orgId;

    if (!userId) throw new UnauthorizedException();
    if (!orgId) throw new NotFoundException('Organization not found');

    const [orgRow] = await this.database
      .select({ id: orgSchema.organization.id })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);
    if (!orgRow) throw new NotFoundException('Organization not found');

    const [userRow] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);
    if (!userRow) throw new UnauthorizedException();

    if (userRow.role === 'super-admin' || userRow.role === 'system-admin') {
      return true;
    }

    const [membership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    if (membership?.role !== 'org-owner' && membership?.role !== 'org-admin') {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
