import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { mapWithConcurrency } from '../lib/concurrency';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import { IcebreakersQueryService } from './icebreakers-query.service';

type Database = NodePgDatabase<typeof icebreakersSchema & typeof teamSchema>;

const PROJECTION = 'icebreakers';

@Injectable()
export class IcebreakersProjectionSyncService implements OnModuleInit {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly convexClient: ConvexMutationClientService,
    private readonly outbox: ProjectionOutboxService,
    private readonly icebreakersQueryService: IcebreakersQueryService,
  ) {}

  onModuleInit(): void {
    // Deliver outbox intents by recomputing current state from PostgreSQL.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) =>
      operation === 'delete'
        ? this.deleteSessionProjection(entityKey)
        : this.syncSessionProjection(entityKey),
    );
  }

  /**
   * Durably enqueue a session (re)projection. Replaces the old fire-and-forget
   * push at call-sites: the intent commits to the outbox and is delivered
   * immediately (best-effort) plus guaranteed by the dispatcher.
   */
  async enqueueSessionSync(sessionId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: sessionId,
    });
  }

  /** Durably enqueue removal of an icebreaker session projection. */
  async enqueueSessionDelete(sessionId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: sessionId,
    });
  }

  async syncSessionProjection(sessionId: string): Promise<void> {
    if (!this.convexClient.isConfigured()) {
      return;
    }

    const [session] = await this.database
      .select({
        id: icebreakersSchema.icebreakerSession.id,
        teamId: icebreakersSchema.icebreakerSession.teamId,
        status: icebreakersSchema.icebreakerSession.status,
        currentPromptId: icebreakersSchema.icebreakerSession.currentPromptId,
      })
      .from(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!session) {
      return;
    }

    const updatedAt = Date.now();

    await this.convexClient.runMutation(
      'liveIcebreakers:upsertSessionProjection',
      {
        sessionId: session.id,
        teamId: session.teamId,
        status: session.status,
        currentPromptId: session.currentPromptId ?? undefined,
        updatedAt,
      },
    );

    await this.syncSessionBoardSnapshots(session.id, session.teamId, updatedAt);
  }

  async deleteSessionProjection(sessionId: string): Promise<void> {
    if (!this.convexClient.isConfigured()) {
      return;
    }

    await this.convexClient.runMutation(
      'liveIcebreakers:deleteSessionProjection',
      {
        sessionId,
      },
    );
  }

  /**
   * Rebuild every icebreaker session projection (session + per-member board
   * snapshots) from PostgreSQL. Re-uses {@link syncSessionProjection} per
   * session so the board fan-out logic stays in one place; each upsert stamps
   * `updatedAt` with a fresh `Date.now()`, which the reconciliation
   * orchestrator's mark-and-sweep (prune rows older than a timestamp captured
   * before this pass) relies on. Returns the number of sessions scanned. No-ops
   * when Convex is unconfigured.
   */
  async syncAllSessions(): Promise<{ scanned: number }> {
    if (!this.convexClient.isConfigured()) {
      return { scanned: 0 };
    }

    const sessions = await this.database
      .select({ id: icebreakersSchema.icebreakerSession.id })
      .from(icebreakersSchema.icebreakerSession);

    for (const session of sessions) {
      await this.syncSessionProjection(session.id);
    }

    return { scanned: sessions.length };
  }

  private async syncSessionBoardSnapshots(
    sessionId: string,
    teamId: string,
    updatedAt: number,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    if (members.length === 0) {
      return;
    }

    // Push every member's board snapshot. A failure propagates so the outbox
    // retries the whole (idempotent) delivery — re-pushing all members is safe.
    await mapWithConcurrency(members, 2, async ({ userId }) => {
      const session = await this.icebreakersQueryService.getSession(
        userId,
        sessionId,
      );

      await this.convexClient.runMutation(
        'liveIcebreakers:upsertIcebreakerBoard',
        {
          sessionId,
          userId,
          snapshot: JSON.stringify({ session }),
          updatedAt,
        },
      );
    });
  }
}
