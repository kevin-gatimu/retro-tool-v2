import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as surveysSchema from './schema';

type Database = NodePgDatabase<typeof surveysSchema>;

/**
 * Pushes a lightweight survey projection into Convex after each mutation so the
 * surveys list and active-count badge update in realtime. PostgreSQL remains the
 * source of truth; the UI refetches the REST endpoints (which apply per-viewer
 * authorization, keep anonymity, and gate results) whenever this projection
 * changes. No-ops silently when Convex is not configured.
 */
@Injectable()
export class SurveysProjectionSyncService {
  private readonly logger = new Logger(SurveysProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

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

  private async runMutation(path: string, args: object): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    try {
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
        this.logger.warn(
          `Convex survey projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex survey projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex survey projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
