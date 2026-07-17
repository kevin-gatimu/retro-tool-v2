import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as authSchema from '../../auth/schema';
import type { ReportsRequestSession } from '../types';

type Database = NodePgDatabase<typeof authSchema>;

/** `/reports/v2/platform` — super-admin / system-admin only. */
@Injectable()
export class SystemReportAccessGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ReportsRequestSession>();
    const userId = request.session?.user?.id;
    if (!userId) throw new UnauthorizedException();

    const [userRow] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (userRow?.role !== 'super-admin' && userRow?.role !== 'system-admin') {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
