import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import { IcebreakersQueryService } from './icebreakers-query.service';

type Database = NodePgDatabase<typeof icebreakersSchema & typeof teamSchema>;

@Injectable()
export class IcebreakersProjectionSyncService {
  private readonly logger = new Logger(IcebreakersProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly icebreakersQueryService: IcebreakersQueryService,
  ) {}

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
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(
            `Convex icebreaker board snapshot sync failed for sessionId=${sessionId} userId=${userId}: ${message}`,
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
          `Convex icebreaker projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex icebreaker projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex icebreaker projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
