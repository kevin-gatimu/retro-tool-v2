import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as authSchema from './schema';
import { USER_STATUSES } from '../common/enums';

@Injectable()
export class SignupCleanupMiddleware implements NestMiddleware {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: NodePgDatabase,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const body = req.body as { email?: string } | undefined;
    const email = body?.email;
    if (!email) return next();

    await this.database
      .delete(authSchema.user)
      .where(
        and(
          eq(authSchema.user.email, email.toLowerCase()),
          eq(authSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    next();
  }
}
