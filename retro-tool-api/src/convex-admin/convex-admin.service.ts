import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CommonService } from '../common/common.service';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as adminSchema from './schema';
import type { UpdateCronConfigDto } from './dto/update-cron-config.dto';
import type { ConvexAdminCronService } from './convex-admin-cron.service';
import type {
  OperationalMetrics,
  UsageMetrics,
  ConvexCronConfigResponse,
} from './types';

export type { OperationalMetrics, UsageMetrics, ConvexCronConfigResponse };

type Database = NodePgDatabase<typeof adminSchema>;

const SINGLETON_ID = 'singleton';

@Injectable()
export class ConvexAdminService {
  private readonly logger = new Logger(ConvexAdminService.name);
  private cronService: ConvexAdminCronService | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly commonService: CommonService,
  ) {}

  /** Injected post-construction to avoid circular dependency */
  setCronService(cronService: ConvexAdminCronService): void {
    this.cronService = cronService;
  }

  // ---------------------------------------------------------------------------
  // Operational metrics (from self-hosted admin API)
  // ---------------------------------------------------------------------------

  async getOperationalMetrics(userId: string): Promise<OperationalMetrics> {
    await this.assertSuperAdmin(userId);

    const convexConfig = this.configService.get('convex', { infer: true });
    const baseUrl = convexConfig?.url?.replace(/\/$/, '');

    if (!baseUrl || !convexConfig?.adminKey) {
      return this.emptyOperationalMetrics();
    }

    const headers = {
      Authorization: `Convex ${convexConfig.adminKey}`,
      'Content-Type': 'application/json',
    };

    const now = Date.now();
    const windowStart = now - 5 * 60 * 1000;

    const [
      topFunctionsRes,
      cacheHitRes,
      latencyRes,
      jobLagRes,
      concurrencyRes,
      tableRateRes,
    ] = await Promise.allSettled([
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/function_call_count_top_k?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}&k=10`,
        headers,
      ),
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/cache_hit_percentage?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}`,
        headers,
      ),
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/latency_percentiles?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}`,
        headers,
      ),
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/scheduled_job_lag?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}`,
        headers,
      ),
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/function_concurrency?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}`,
        headers,
      ),
      this.fetchMetric(
        `${baseUrl}/api/app_metrics/table_rate?window_start_unix_ms=${windowStart}&window_end_unix_ms=${now}`,
        headers,
      ),
    ]);

    return {
      topFunctions: this.extractTopFunctions(topFunctionsRes),
      cacheHitPercentage: this.extractScalar(cacheHitRes),
      latencyPercentiles: this.extractLatency(latencyRes),
      scheduledJobLag: this.extractScalar(jobLagRes),
      functionConcurrency: this.extractScalar(concurrencyRes),
      tableRates: this.extractTableRates(tableRateRes),
    };
  }

  // ---------------------------------------------------------------------------
  // Usage / billing metrics (from Convex Cloud API — optional)
  // ---------------------------------------------------------------------------

  async getUsageMetrics(userId: string): Promise<UsageMetrics | null> {
    await this.assertSuperAdmin(userId);

    const convexConfig = this.configService.get('convex', { infer: true });
    const cloudApiUrl = convexConfig?.url?.replace(/\/$/, '');
    const deployKey = convexConfig?.adminKey;

    if (!cloudApiUrl || !deployKey) {
      return null;
    }

    try {
      const headers = {
        Authorization: `Convex ${deployKey}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${cloudApiUrl}/api/deploy2/usage_stats`, {
        headers,
      });

      if (!response.ok) {
        this.logger.debug(
          `Convex Cloud usage API returned ${response.status} — usage metrics unavailable`,
        );
        return null;
      }

      const data = (await response.json()) as Record<string, unknown>;
      return this.mapUsageMetrics(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.debug(
        `Failed to fetch Convex Cloud usage metrics: ${message}`,
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Table clearing
  // ---------------------------------------------------------------------------

  async clearTables(
    userId: string,
    tableNames: string[],
  ): Promise<{ cleared: string[] }> {
    await this.assertSuperAdmin(userId);
    return this.runMutation('admin:clearTables', { tableNames });
  }

  // ---------------------------------------------------------------------------
  // Cron config
  // ---------------------------------------------------------------------------

  async getCronConfig(): Promise<ConvexCronConfigResponse> {
    const rows = await this.database
      .select()
      .from(adminSchema.convexCronConfig)
      .limit(1);

    if (rows.length === 0) {
      return {
        id: SINGLETON_ID,
        schedule: '0 0 * * 0',
        enabled: false,
        tablesToClear: [],
        updatedAt: null,
        updatedByUserId: null,
      };
    }

    const row = rows[0];
    return {
      id: row.id,
      schedule: row.schedule,
      enabled: row.enabled,
      tablesToClear: row.tablesToClear ?? [],
      updatedAt: row.updatedAt?.toISOString() ?? null,
      updatedByUserId: row.updatedByUserId,
    };
  }

  async updateCronConfig(
    userId: string,
    dto: UpdateCronConfigDto,
  ): Promise<ConvexCronConfigResponse> {
    await this.assertSuperAdmin(userId);

    const existing = await this.getCronConfig();

    const updated = {
      id: SINGLETON_ID,
      schedule: dto.schedule ?? existing.schedule,
      enabled: dto.enabled ?? existing.enabled,
      tablesToClear: dto.tablesToClear ?? existing.tablesToClear,
      updatedAt: new Date(),
      updatedByUserId: userId,
    };

    await this.database
      .insert(adminSchema.convexCronConfig)
      .values(updated)
      .onConflictDoUpdate({
        target: adminSchema.convexCronConfig.id,
        set: {
          schedule: updated.schedule,
          enabled: updated.enabled,
          tablesToClear: updated.tablesToClear,
          updatedAt: updated.updatedAt,
          updatedByUserId: updated.updatedByUserId,
        },
      });

    const result: ConvexCronConfigResponse = {
      ...updated,
      tablesToClear: updated.tablesToClear,
      updatedAt: updated.updatedAt.toISOString(),
    };

    this.cronService?.reschedule({
      enabled: result.enabled,
      schedule: result.schedule,
      tablesToClear: result.tablesToClear,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Convex HTTP admin API — mutation runner
  // ---------------------------------------------------------------------------

  async runMutation(
    path: string,
    args: object,
  ): Promise<{ cleared: string[] }> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      this.logger.warn('Convex not configured — skipping mutation call');
      return { cleared: [] };
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
          body: JSON.stringify({ path, args, format: 'json' }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Convex admin mutation ${path} failed with status ${response.status}`,
        );
        return { cleared: [] };
      }

      const result = (await response.json()) as ConvexFunctionResponse & {
        value?: { cleared: string[] };
      };

      if (result.status === 'error') {
        this.logger.warn(
          `Convex admin mutation ${path} returned error: ${result.errorMessage ?? 'unknown'}`,
        );
        return { cleared: [] };
      }

      return result.value ?? { cleared: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Convex admin mutation ${path} failed: ${message}`);
      return { cleared: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async assertSuperAdmin(userId: string): Promise<void> {
    const ok = await this.commonService.isSuperAdmin(userId);
    if (!ok)
      throw new ForbiddenException('Only super-admin can perform this action');
  }

  private async fetchMetric(
    url: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  private emptyOperationalMetrics(): OperationalMetrics {
    return {
      topFunctions: [],
      cacheHitPercentage: null,
      latencyPercentiles: null,
      scheduledJobLag: null,
      functionConcurrency: null,
      tableRates: [],
    };
  }

  private extractTopFunctions(
    result: PromiseSettledResult<unknown>,
  ): Array<{ identifier: string; calls: number }> {
    if (result.status === 'rejected') return [];
    const data = result.value as {
      functions?: Array<{ identifier: string; calls?: number }>;
    };
    return (data?.functions ?? []).map((f) => ({
      identifier: f.identifier,
      calls: f.calls ?? 0,
    }));
  }

  private extractScalar(result: PromiseSettledResult<unknown>): number | null {
    if (result.status === 'rejected') return null;
    const data = result.value as { value?: number };
    return data?.value ?? null;
  }

  private extractLatency(
    result: PromiseSettledResult<unknown>,
  ): { p50: number; p95: number; p99: number } | null {
    if (result.status === 'rejected') return null;
    const data = result.value as { p50?: number; p95?: number; p99?: number };
    if (data?.p50 === undefined) return null;
    return { p50: data.p50 ?? 0, p95: data.p95 ?? 0, p99: data.p99 ?? 0 };
  }

  private extractTableRates(
    result: PromiseSettledResult<unknown>,
  ): Array<{ tableName: string; reads: number; writes: number }> {
    if (result.status === 'rejected') return [];
    const data = result.value as {
      tables?: Array<{ tableName: string; reads?: number; writes?: number }>;
    };
    return (data?.tables ?? []).map((t) => ({
      tableName: t.tableName,
      reads: t.reads ?? 0,
      writes: t.writes ?? 0,
    }));
  }

  private mapUsageMetrics(data: Record<string, unknown>): UsageMetrics {
    const toMetric = (used: unknown, quota: unknown) =>
      typeof used === 'number' && typeof quota === 'number'
        ? { used, quota }
        : null;

    return {
      functionCalls: toMetric(data.functionCallsUsed, data.functionCallsQuota),
      actionCompute: toMetric(data.actionComputeUsed, data.actionComputeQuota),
      databaseStorage: toMetric(
        data.databaseStorageUsed,
        data.databaseStorageQuota,
      ),
      databaseBandwidth: toMetric(
        data.databaseBandwidthUsed,
        data.databaseBandwidthQuota,
      ),
      fileStorage: toMetric(data.fileStorageUsed, data.fileStorageQuota),
      fileBandwidth: toMetric(data.fileBandwidthUsed, data.fileBandwidthQuota),
      vectorStorage: toMetric(data.vectorStorageUsed, data.vectorStorageQuota),
      vectorBandwidth: toMetric(
        data.vectorBandwidthUsed,
        data.vectorBandwidthQuota,
      ),
      deployments: toMetric(data.deploymentsUsed, data.deploymentsQuota),
      chefTokens: toMetric(data.chefTokensUsed, data.chefTokensQuota),
    };
  }
}
