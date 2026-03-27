import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as userSchema from '../../auth/schema';

type Database = NodePgDatabase<typeof userSchema>;

// Only update lastActiveAt if it has been more than 5 minutes since last update
const DEBOUNCE_MS = 5 * 60 * 1000;

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      session?: { user?: { id?: string } };
    }>();

    const userId = request.session?.user?.id;
    if (userId) {
      // Fire-and-forget — do not block the response
      this.updateLastActive(userId).catch(() => undefined);
    }

    return next.handle();
  }

  private async updateLastActive(userId: string): Promise<void> {
    const threshold = new Date(Date.now() - DEBOUNCE_MS);

    await this.database
      .update(userSchema.user)
      .set({ lastActiveAt: new Date() })
      .where(
        and(
          eq(userSchema.user.id, userId),
          // Only update if lastActiveAt is null or older than the debounce threshold
          or(
            isNull(userSchema.user.lastActiveAt),
            lt(userSchema.user.lastActiveAt, threshold),
          ),
        ),
      );
  }
}
