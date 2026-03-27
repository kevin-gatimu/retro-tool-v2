import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ne } from 'drizzle-orm';
import * as sessionSchema from './schema';
import { Session } from './schema';
import { RevokeSessionDto } from './dtos';

type Database = NodePgDatabase<typeof sessionSchema>;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
  ) {}

  async listSessions(userId: string): Promise<Session[]> {
    return this.database
      .select()
      .from(sessionSchema.session)
      .where(eq(sessionSchema.session.userId, userId))
      .orderBy(sessionSchema.session.createdAt);
  }

  async revokeSession(
    userId: string,
    data: RevokeSessionDto,
  ): Promise<{ success: boolean }> {
    const [existing] = await this.database
      .select()
      .from(sessionSchema.session)
      .where(eq(sessionSchema.session.token, data.token))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Session not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only revoke your own sessions');
    }

    await this.database
      .delete(sessionSchema.session)
      .where(
        and(
          eq(sessionSchema.session.token, data.token),
          eq(sessionSchema.session.userId, userId),
        ),
      );

    return { success: true };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ success: boolean }> {
    await this.database
      .delete(sessionSchema.session)
      .where(
        and(
          eq(sessionSchema.session.userId, userId),
          ne(sessionSchema.session.id, currentSessionId),
        ),
      );

    return { success: true };
  }
}
