import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
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
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly convexClient: ConvexMutationClientService,
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
    if (!this.convexClient.isConfigured()) {
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

    await this.convexClient.runMutation('liveSurveys:upsertSurveyProjection', {
      surveyId: record.id,
      scope: record.scope,
      teamId: record.teamId ?? undefined,
      organizationId: record.organizationId ?? undefined,
      isClosed: record.isClosed,
      updatedAt: Date.now(),
    });
  }

  async deleteSurveyProjection(surveyId: string): Promise<void> {
    if (!this.convexClient.isConfigured()) {
      return;
    }

    await this.convexClient.runMutation('liveSurveys:deleteSurveyProjection', {
      surveyId,
    });
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
    if (!this.convexClient.isConfigured()) {
      return { scanned: 0 };
    }

    const surveys = await this.database
      .select({ id: surveysSchema.survey.id })
      .from(surveysSchema.survey);

    for (const survey of surveys) {
      await this.syncSurveyProjection(survey.id);
    }

    return { scanned: surveys.length };
  }
}
