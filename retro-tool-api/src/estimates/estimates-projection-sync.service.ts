import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import * as estimatesSchema from './schema';

type Database = NodePgDatabase<typeof estimatesSchema>;

interface ConvexFunctionResponse {
  status: 'success' | 'error';
  errorMessage?: string;
}

@Injectable()
export class EstimatesProjectionSyncService {
  private readonly logger = new Logger(EstimatesProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

  async syncSessionProjection(sessionId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const [session] = await this.database
      .select({
        id: estimatesSchema.storyEstimateSession.id,
        teamId: estimatesSchema.storyEstimateSession.teamId,
        status: estimatesSchema.storyEstimateSession.status,
        currentRoundId: estimatesSchema.storyEstimateSession.currentRoundId,
        updatedAt: estimatesSchema.storyEstimateSession.updatedAt,
      })
      .from(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!session) {
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
            path: 'liveEstimates:upsertSessionProjection',
            args: {
              sessionId: session.id,
              teamId: session.teamId,
              status: session.status,
              currentRoundId: session.currentRoundId ?? undefined,
              updatedAt: session.updatedAt.getTime(),
            },
            format: 'json',
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Convex projection sync failed for session ${sessionId} with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex projection sync returned an error for session ${sessionId}: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex projection sync request failed for session ${sessionId}: ${message}`,
      );
    }
  }
}
