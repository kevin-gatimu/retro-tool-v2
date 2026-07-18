import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as retroSchema from './schema';
import * as teamSchema from '../teams/schema';
import { RetrosService } from './retros.service';

type Database = NodePgDatabase<typeof retroSchema & typeof teamSchema>;

const PROJECTION = 'retros';

@Injectable()
export class RetrosProjectionSyncService implements OnModuleInit {
  private readonly logger = new Logger(RetrosProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly outbox: ProjectionOutboxService,
    private readonly retrosService: RetrosService,
  ) {}

  onModuleInit(): void {
    // Deliver outbox intents by recomputing current state from PostgreSQL.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) =>
      operation === 'delete'
        ? this.deleteRetroProjection(entityKey)
        : this.syncRetroProjection(entityKey),
    );
  }

  /**
   * Durably enqueue a retro (re)projection. Replaces the old fire-and-forget
   * push at call-sites: the intent commits to the outbox and is delivered
   * immediately (best-effort) plus guaranteed by the dispatcher.
   */
  async enqueueRetroSync(retroId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: retroId,
    });
  }

  /** Durably enqueue removal of a retro projection. */
  async enqueueRetroDelete(retroId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: retroId,
    });
  }

  async syncRetroProjection(retroId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const [retro] = await this.database
      .select({
        id: retroSchema.retrospective.id,
        teamId: retroSchema.retrospective.teamId,
        status: retroSchema.retrospective.status,
        currentDiscussionCardId:
          retroSchema.retrospective.currentDiscussionCardId,
        currentDiscussionActionItemId:
          retroSchema.retrospective.currentDiscussionActionItemId,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) {
      return;
    }

    const updatedAt = Date.now();

    await this.runMutation('liveRetros:upsertRetroProjection', {
      retroId: retro.id,
      teamId: retro.teamId,
      status: retro.status,
      currentDiscussionCardId: retro.currentDiscussionCardId ?? undefined,
      currentDiscussionActionItemId:
        retro.currentDiscussionActionItemId ?? undefined,
      updatedAt,
    });

    await this.syncRetroBoardSnapshots(retro.id, retro.teamId, updatedAt);
  }

  async deleteRetroProjection(retroId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('liveRetros:deleteRetroProjection', {
      retroId,
    });
  }

  /**
   * Rebuild every retro projection (session + per-member board snapshots) from
   * PostgreSQL. Re-uses {@link syncRetroProjection} per retro so the board
   * fan-out logic stays in one place; each upsert stamps `updatedAt` with a
   * fresh `Date.now()`, which the reconciliation orchestrator's mark-and-sweep
   * (prune rows older than a timestamp captured before this pass) relies on.
   * Returns the number of retros scanned. No-ops when Convex is unconfigured.
   */
  async syncAllRetros(): Promise<{ scanned: number }> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return { scanned: 0 };
    }

    const retros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective);

    for (const retro of retros) {
      try {
        await this.syncRetroProjection(retro.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Reconcile: retro ${retro.id} projection failed: ${message}`,
        );
      }
    }

    return { scanned: retros.length };
  }

  private async syncRetroBoardSnapshots(
    retroId: string,
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
        const [retro, previousCarriedItems] = await Promise.all([
          this.retrosService.getRetro(userId, retroId),
          this.retrosService.getPreviousCarriedForward(userId, retroId),
        ]);

        await this.runMutation('liveRetros:upsertRetroBoard', {
          retroId,
          userId,
          snapshot: JSON.stringify({
            retro,
            previousCarriedItems,
          }),
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
        `Convex retro projection mutation ${path} failed with status ${response.status}`,
      );
    }

    const result = (await response.json()) as ConvexFunctionResponse;
    if (result.status === 'error') {
      throw new Error(
        `Convex retro projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }
}
