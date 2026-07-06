import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as pollsSchema from './schema';

type Database = NodePgDatabase<typeof pollsSchema>;

/**
 * Pushes a lightweight poll projection into Convex after each mutation so the
 * polls list updates in realtime. PostgreSQL remains the source of truth; the
 * UI refetches the REST list (which applies per-viewer authorization) whenever
 * this projection changes. No-ops silently when Convex is not configured.
 */
@Injectable()
export class PollsProjectionSyncService {
  private readonly logger = new Logger(PollsProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

  async syncPollProjection(pollId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const [record] = await this.database
      .select({
        id: pollsSchema.poll.id,
        teamId: pollsSchema.poll.teamId,
        isClosed: pollsSchema.poll.isClosed,
      })
      .from(pollsSchema.poll)
      .where(eq(pollsSchema.poll.id, pollId))
      .limit(1);

    if (!record) {
      return;
    }

    await this.runMutation('livePolls:upsertPollProjection', {
      pollId: record.id,
      teamId: record.teamId,
      isClosed: record.isClosed,
      updatedAt: Date.now(),
    });
  }

  async deletePollProjection(pollId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('livePolls:deletePollProjection', { pollId });
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
          `Convex poll projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex poll projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex poll projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
