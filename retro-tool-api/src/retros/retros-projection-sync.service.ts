import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import * as retroSchema from './schema';

type Database = NodePgDatabase<typeof retroSchema>;

interface ConvexFunctionResponse {
  status: 'success' | 'error';
  errorMessage?: string;
}

@Injectable()
export class RetrosProjectionSyncService {
  private readonly logger = new Logger(RetrosProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

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
        updatedAt: retroSchema.retrospective.updatedAt,
      })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) {
      return;
    }

    await this.runMutation('liveRetros:upsertRetroProjection', {
      retroId: retro.id,
      teamId: retro.teamId,
      status: retro.status,
      currentDiscussionCardId: retro.currentDiscussionCardId ?? undefined,
      currentDiscussionActionItemId:
        retro.currentDiscussionActionItemId ?? undefined,
      updatedAt: retro.updatedAt.getTime(),
    });
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
          `Convex retro projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex retro projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex retro projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
