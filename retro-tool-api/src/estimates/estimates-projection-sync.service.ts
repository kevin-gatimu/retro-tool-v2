import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as estimatesSchema from './schema';
import * as teamSchema from '../teams/schema';
import { EstimatesService } from './estimates.service';

type Database = NodePgDatabase<typeof estimatesSchema & typeof teamSchema>;

@Injectable()
export class EstimatesProjectionSyncService {
  private readonly logger = new Logger(EstimatesProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly estimatesService: EstimatesService,
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
      })
      .from(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!session) {
      return;
    }

    const updatedAt = Date.now();

    await this.runMutation('liveEstimates:upsertSessionProjection', {
      sessionId: session.id,
      teamId: session.teamId,
      status: session.status,
      currentRoundId: session.currentRoundId ?? undefined,
      updatedAt,
    });

    await this.syncSessionBoardSnapshots(session.id, session.teamId, updatedAt);
  }

  async deleteSessionProjection(sessionId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('liveEstimates:deleteSessionProjection', {
      sessionId,
    });
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

    await Promise.all(
      members.map(async ({ userId }) => {
        try {
          const session = await this.estimatesService.getSession(
            userId,
            sessionId,
          );

          await this.runMutation('liveEstimates:upsertEstimateBoard', {
            sessionId,
            userId,
            snapshot: JSON.stringify({ session }),
            updatedAt,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(
            `Convex estimate board snapshot sync failed for sessionId=${sessionId} userId=${userId}: ${message}`,
          );
        }
      }),
    );
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
          `Convex estimate projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex estimate projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex estimate projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
