import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import { IcebreakersQueryService } from './icebreakers-query.service';

type Database = NodePgDatabase<typeof icebreakersSchema & typeof teamSchema>;

const PROJECTION = 'icebreakers';

@Injectable()
export class IcebreakersProjectionSyncService implements OnModuleInit {
  private readonly logger = new Logger(IcebreakersProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
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
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
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

    await this.runMutation('liveIcebreakers:upsertSessionProjection', {
      sessionId: session.id,
      teamId: session.teamId,
      status: session.status,
      currentPromptId: session.currentPromptId ?? undefined,
      updatedAt,
    });

    await this.syncSessionBoardSnapshots(session.id, session.teamId, updatedAt);
  }

  async deleteSessionProjection(sessionId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('liveIcebreakers:deleteSessionProjection', {
      sessionId,
    });
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
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return { scanned: 0 };
    }

    const sessions = await this.database
      .select({ id: icebreakersSchema.icebreakerSession.id })
      .from(icebreakersSchema.icebreakerSession);

    for (const session of sessions) {
      try {
        await this.syncSessionProjection(session.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Reconcile: icebreaker session ${session.id} projection failed: ${message}`,
        );
      }
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
    await Promise.all(
      members.map(async ({ userId }) => {
        const session = await this.icebreakersQueryService.getSession(
          userId,
          sessionId,
        );

        await this.runMutation('liveIcebreakers:upsertIcebreakerBoard', {
          sessionId,
          userId,
          snapshot: JSON.stringify({ session }),
          updatedAt,
        });
      }),
    );
  }

  /**
   * POST a projection mutation to Convex. Throws on any transport or
   * Convex-side error so the outbox dispatcher (which wraps delivery) can retry;
   * no-ops silently only when Convex is unconfigured. Reconciliation catches
   * per-entity so one failure does not abort a full rebuild.
   */
  private async runMutation(path: string, args: object): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const response = await fetch(
      `${convexConfig.url.replace(/\/$/, '')}/api/mutation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Convex ${convexConfig.adminKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          args,
          format: 'json',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Convex icebreaker projection mutation ${path} failed with status ${response.status}`,
      );
    }

    const result = (await response.json()) as ConvexFunctionResponse;
    if (result.status === 'error') {
      throw new Error(
        `Convex icebreaker projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }
}
