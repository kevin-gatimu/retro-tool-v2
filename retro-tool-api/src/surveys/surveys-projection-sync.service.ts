import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as surveysSchema from './schema';

type Database = NodePgDatabase<typeof surveysSchema>;

const PROJECTION = 'surveys';

/**
 * Pushes a lightweight survey projection into Convex after each mutation so the
 * surveys list and active-count badge update in realtime. PostgreSQL remains the
 * source of truth; the UI refetches the REST endpoints (which apply per-viewer
 * authorization, keep anonymity, and gate results) whenever this projection
 * changes. No-ops silently when Convex is not configured.
 */
@Injectable()
export class SurveysProjectionSyncService implements OnModuleInit {
  private readonly logger = new Logger(SurveysProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly outbox: ProjectionOutboxService,
  ) {}

  onModuleInit(): void {
    // Deliver outbox intents by recomputing current state from PostgreSQL.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) =>
      operation === 'delete'
        ? this.deleteSurveyProjection(entityKey)
        : this.syncSurveyProjection(entityKey),
    );
  }

  /**
   * Durably enqueue a survey (re)projection. Replaces the old fire-and-forget
   * push at call-sites: the intent commits to the outbox and is delivered
   * immediately (best-effort) plus guaranteed by the dispatcher.
   */
  async enqueueSurveySync(surveyId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: surveyId,
    });
  }

  /** Durably enqueue removal of a survey projection. */
  async enqueueSurveyDelete(surveyId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: surveyId,
    });
  }

  async syncSurveyProjection(surveyId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const [record] = await this.database
      .select({
        id: surveysSchema.survey.id,
        scope: surveysSchema.survey.scope,
        teamId: surveysSchema.survey.teamId,
        organizationId: surveysSchema.survey.organizationId,
        isClosed: surveysSchema.survey.isClosed,
      })
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);

    if (!record) {
      return;
    }

    await this.runMutation('liveSurveys:upsertSurveyProjection', {
      surveyId: record.id,
      scope: record.scope,
      teamId: record.teamId ?? undefined,
      organizationId: record.organizationId ?? undefined,
      isClosed: record.isClosed,
      updatedAt: Date.now(),
    });
  }

  async deleteSurveyProjection(surveyId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('liveSurveys:deleteSurveyProjection', { surveyId });
  }

  /**
   * Rebuild every survey projection from PostgreSQL. Re-uses
   * {@link syncSurveyProjection} per survey so the projection-shaping logic
   * stays in one place; each upsert stamps `updatedAt` with a fresh
   * `Date.now()`, which the reconciliation orchestrator's mark-and-sweep (prune
   * rows older than a timestamp captured before this pass) relies on. Returns
   * the number of surveys scanned. No-ops when Convex is unconfigured.
   */
  async syncAllSurveys(): Promise<{ scanned: number }> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return { scanned: 0 };
    }

    const surveys = await this.database
      .select({ id: surveysSchema.survey.id })
      .from(surveysSchema.survey);

    for (const survey of surveys) {
      try {
        await this.syncSurveyProjection(survey.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Reconcile: survey ${survey.id} projection failed: ${message}`,
        );
      }
    }

    return { scanned: surveys.length };
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
        `Convex survey projection mutation ${path} failed with status ${response.status}`,
      );
    }

    const result = (await response.json()) as ConvexFunctionResponse;
    if (result.status === 'error') {
      throw new Error(
        `Convex survey projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }
}
