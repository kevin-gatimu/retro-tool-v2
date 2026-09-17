import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CommonService } from '../common/common.service';
import { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as adminSchema from './schema';
import type { UpdateCronConfigDto } from './dto/update-cron-config.dto';
import type { ConvexAdminCronService } from './convex-admin-cron.service';
import { ProjectionReconciliationService } from './projection-reconciliation.service';
import { ProjectionOutboxService } from './projection-outbox.service';
import type {
  ConvexHealthCheck,
  ConvexInsight,
  MetricFetchError,
  MetricPoint,
  NamedMetricSeries,
  OperationalMetrics,
  UsageMetrics,
  ConvexCronConfigResponse,
  ReconcileAllResponse,
  OutboxStatusResponse,
} from './types';

export type { OperationalMetrics, UsageMetrics, ConvexCronConfigResponse };

type Database = NodePgDatabase<typeof adminSchema>;

const SINGLETON_ID = 'singleton';

const OPERATIONAL_METRIC_WINDOWS = new Map<number, number>([
  [15, 15],
  [60, 60],
  [360, 72],
  [1440, 96],
  [10_080, 168],
  [43_200, 180],
  [129_600, 180],
  [525_600, 365],
]);

@Injectable()
export class ConvexAdminService {
  private readonly logger = new Logger(ConvexAdminService.name);
  private cronService: ConvexAdminCronService | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly commonService: CommonService,
    private readonly teamsMembersProjectionSync: TeamsMembersProjectionSyncService,
    private readonly projectionReconciliation: ProjectionReconciliationService,
    private readonly projectionOutbox: ProjectionOutboxService,
  ) {}

  /** Injected post-construction to avoid circular dependency */
  setCronService(cronService: ConvexAdminCronService): void {
    this.cronService = cronService;
  }

  // ---------------------------------------------------------------------------
  // Operational metrics (from self-hosted admin API)
  // ---------------------------------------------------------------------------

  async getOperationalMetrics(
    userId: string,
    requestedRangeMinutes = 60,
  ): Promise<OperationalMetrics> {
    await this.assertSuperAdmin(userId);

    const rangeMinutes = OPERATIONAL_METRIC_WINDOWS.has(requestedRangeMinutes)
      ? requestedRangeMinutes
      : 60;
    const bucketCount = OPERATIONAL_METRIC_WINDOWS.get(rangeMinutes) ?? 60;
    const bucketMinutes = rangeMinutes / bucketCount;
    const generatedAt = new Date();
    const convexConfig = this.configService.get('convex', { infer: true });
    const baseUrl = convexConfig?.url?.replace(/\/$/, '');

    if (!baseUrl || !convexConfig?.adminKey) {
      return this.emptyOperationalMetrics(
        generatedAt,
        rangeMinutes,
        bucketCount,
        bucketMinutes,
        'Convex URL or admin key is not configured',
      );
    }

    const headers = {
      Authorization: `Convex ${convexConfig.adminKey}`,
      'Convex-Client': 'dashboard-0.0.0',
    };
    const start = new Date(generatedAt.getTime() - rangeMinutes * 60_000);
    const window = JSON.stringify({
      start: this.serializeDate(start),
      end: this.serializeDate(generatedAt),
      num_buckets: bucketCount,
    });
    const metricRequests = [
      ['functionCalls', 'function_call_count_top_k', { window, k: '10' }],
      ['failurePercentages', 'failure_percentage_top_k', { window, k: '10' }],
      [
        'cacheHitPercentages',
        'cache_hit_percentage_top_k',
        { window, k: '10' },
      ],
      [
        'subscriptionInvalidations',
        'subscription_invalidations_top_k',
        { window, k: '10' },
      ],
      ['scheduledJobLag', 'scheduled_job_lag', { window }],
      ['concurrency', 'function_concurrency', { window }],
    ] as const;

    const results = await Promise.allSettled([
      ...metricRequests.map(([, route, params]) =>
        this.fetchMetric(baseUrl, route, params, headers),
      ),
      this.fetchVersion(baseUrl, headers),
    ]);
    const errors: MetricFetchError[] = [];
    const value = (index: number): unknown => {
      const result = results[index];
      if (result.status === 'fulfilled') return result.value;
      const metric = metricRequests[index]?.[0] ?? 'deployment';
      errors.push({ metric, message: this.errorMessage(result.reason) });
      return null;
    };

    const functionCalls = this.parseTopK(value(0));
    const failurePercentages = this.parseTopK(value(1));
    const cacheHitPercentages = this.parseTopK(value(2));
    const subscriptionInvalidations = this.parseTopK(value(3));
    const scheduledJobLag = this.parseTimeseries(value(4));
    const concurrency = this.parseConcurrency(value(5));
    const deploymentVersion = value(6);
    const metricErrorCount = errors.filter(
      ({ metric }) => metric !== 'deployment',
    ).length;
    const successfulMetrics = metricRequests.length - metricErrorCount;
    const status =
      successfulMetrics === metricRequests.length
        ? 'available'
        : successfulMetrics === 0
          ? 'unavailable'
          : 'partial';
    const totalCalls = this.sumSeries(functionCalls);
    const summaries = {
      totalCalls,
      maxFailurePercentage: this.maxSeries(failurePercentages),
      averageCacheHitPercentage: this.averageSeries(cacheHitPercentages),
      maxScheduledJobLagSeconds: this.maxPoints(scheduledJobLag),
      peakRunning: this.maxCombinedSeries(concurrency.running),
      peakQueued: this.maxCombinedSeries(concurrency.queued),
      averageCallsPerMinute:
        totalCalls === null ? null : totalCalls / rangeMinutes,
      queuedBucketPercentage: this.nonZeroBucketPercentage(concurrency.queued),
    };
    const checks = this.buildHealthChecks(
      deploymentVersion,
      status,
      summaries,
      generatedAt,
    );
    const healthStatus = checks.some((check) => check.status === 'unavailable')
      ? 'unavailable'
      : checks.some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return {
      generatedAt: generatedAt.toISOString(),
      rangeMinutes,
      bucketCount,
      bucketMinutes,
      status,
      errors,
      functionCalls,
      failurePercentages,
      cacheHitPercentages,
      subscriptionInvalidations,
      scheduledJobLag,
      concurrency,
      summaries,
      health: { status: healthStatus, checks },
      insights: this.buildInsights(
        summaries,
        functionCalls,
        failurePercentages,
        cacheHitPercentages,
        subscriptionInvalidations,
        rangeMinutes,
      ),
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
  // Team-membership projection reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Rebuild the Convex `liveTeamMembers` projection from PostgreSQL. Used to
   * backfill on first deploy of the F1 membership fix and to heal drift. The
   * projection scopes Convex's team-scoped reads, so keeping it in sync with
   * Postgres is a security-relevant operation — super-admin only.
   */
  async reconcileMemberships(userId: string): Promise<{ count: number }> {
    await this.assertSuperAdmin(userId);
    return this.teamsMembersProjectionSync.syncAllMemberships();
  }

  // ---------------------------------------------------------------------------
  // Full projection reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Rebuild every Convex projection from PostgreSQL (membership/security first)
   * and mark-and-sweep stale rows. Super-admin only. Returns a structured,
   * per-projection report; callers can use `ok` to gate a deployment.
   */
  async reconcileAllProjections(userId: string): Promise<ReconcileAllResponse> {
    await this.assertSuperAdmin(userId);
    return this.projectionReconciliation.reconcileAll();
  }

  // ---------------------------------------------------------------------------
  // Projection outbox controls
  // ---------------------------------------------------------------------------

  async getOutboxStatus(userId: string): Promise<OutboxStatusResponse> {
    await this.assertSuperAdmin(userId);
    return this.projectionOutbox.getStatus();
  }

  /**
   * Pause or resume the outbox dispatcher. Pausing lets a stop-first Convex
   * maintenance window keep buffering projection events durably; resuming
   * replays them in order.
   */
  async setOutboxPaused(
    userId: string,
    paused: boolean,
  ): Promise<OutboxStatusResponse> {
    await this.assertSuperAdmin(userId);
    await this.projectionOutbox.setPaused(paused, userId);
    return this.projectionOutbox.getStatus();
  }

  /** Drain the entire pending outbox in order (used after a maintenance pause). */
  async replayOutbox(userId: string): Promise<OutboxStatusResponse> {
    await this.assertSuperAdmin(userId);
    await this.projectionOutbox.replayAll();
    return this.projectionOutbox.getStatus();
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
    baseUrl: string,
    route: string,
    params: Record<string, string>,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(
      `${baseUrl}/api/app_metrics/${route}?${query}`,
      {
        headers,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  private async fetchVersion(
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/version`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  private serializeDate(date: Date) {
    const seconds = date.getTime() / 1000;
    const wholeSeconds = Math.floor(seconds);
    return {
      secs_since_epoch: wholeSeconds,
      nanos_since_epoch: Math.floor((seconds - wholeSeconds) * 1_000_000_000),
    };
  }

  private parseTimeseries(value: unknown): MetricPoint[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): MetricPoint[] => {
      if (!Array.isArray(entry) || entry.length !== 2) return [];
      const [time, metric] = entry as [unknown, unknown];
      if (
        typeof time !== 'object' ||
        time === null ||
        !('secs_since_epoch' in time) ||
        !('nanos_since_epoch' in time)
      ) {
        return [];
      }
      const seconds = Number(time.secs_since_epoch);
      const nanoseconds = Number(time.nanos_since_epoch);
      if (
        !Number.isFinite(seconds) ||
        !Number.isFinite(nanoseconds) ||
        (metric !== null && typeof metric !== 'number')
      ) {
        return [];
      }
      return [
        {
          timestamp: new Date(
            seconds * 1000 + nanoseconds / 1_000_000,
          ).toISOString(),
          value: metric,
        },
      ];
    });
  }

  private parseTopK(value: unknown): NamedMetricSeries[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): NamedMetricSeries[] => {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') return [];
      return [{ name: entry[0], points: this.parseTimeseries(entry[1]) }];
    });
  }

  private parseConcurrency(value: unknown): OperationalMetrics['concurrency'] {
    const result: OperationalMetrics['concurrency'] = {
      running: [],
      queued: [],
    };
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return result;
    }
    for (const [key, rawSeries] of Object.entries(value)) {
      const [prefix, environment, functionType, state] = key.split(':');
      if (prefix !== 'outstanding_functions') continue;
      const displayNames: Record<string, string> = {
        'isolate:Query': 'Queries',
        'isolate:Mutation': 'Mutations',
        'isolate:Action': 'Actions',
        'node:Action': 'Actions (Node)',
        'isolate:HttpAction': 'HTTP Actions',
      };
      const name = displayNames[`${environment}:${functionType}`];
      if (!name || (state !== 'running' && state !== 'queued')) continue;
      result[state].push({ name, points: this.parseTimeseries(rawSeries) });
    }
    return result;
  }

  private numericValues(series: NamedMetricSeries[]): number[] {
    return series.flatMap(({ points }) =>
      points.flatMap(({ value }) => (typeof value === 'number' ? [value] : [])),
    );
  }

  private sumSeries(series: NamedMetricSeries[]): number | null {
    const values = this.numericValues(series);
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0)
      : null;
  }

  private maxSeries(series: NamedMetricSeries[]): number | null {
    const values = this.numericValues(series);
    return values.length > 0 ? Math.max(...values) : null;
  }

  private averageSeries(series: NamedMetricSeries[]): number | null {
    const values = this.numericValues(series);
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  private maxPoints(points: MetricPoint[]): number | null {
    const values = points.flatMap(({ value }) =>
      typeof value === 'number' ? [value] : [],
    );
    return values.length > 0 ? Math.max(...values) : null;
  }

  private maxCombinedSeries(series: NamedMetricSeries[]): number | null {
    if (series.length === 0) return null;
    const bucketCount = Math.max(...series.map(({ points }) => points.length));
    const totals = Array.from({ length: bucketCount }, (_, index) =>
      series.reduce((sum, item) => sum + (item.points[index]?.value ?? 0), 0),
    );
    return totals.length > 0 ? Math.max(...totals) : null;
  }

  private nonZeroBucketPercentage(series: NamedMetricSeries[]): number | null {
    if (series.length === 0) return null;
    const bucketCount = Math.max(...series.map(({ points }) => points.length));
    if (bucketCount === 0) return null;
    const nonZeroBuckets = Array.from({ length: bucketCount }, (_, index) =>
      series.reduce((sum, item) => sum + (item.points[index]?.value ?? 0), 0),
    ).filter((value) => value > 0).length;
    return (nonZeroBuckets / bucketCount) * 100;
  }

  private buildHealthChecks(
    version: unknown,
    metricsStatus: OperationalMetrics['status'],
    summaries: OperationalMetrics['summaries'],
    generatedAt: Date,
  ): ConvexHealthCheck[] {
    return [
      {
        name: 'Deployment API',
        status: typeof version === 'string' ? 'healthy' : 'unavailable',
        message:
          typeof version === 'string'
            ? `Connected${version.trim() ? ` (${version.trim()})` : ''}`
            : 'The Convex deployment did not respond',
      },
      {
        name: 'Metrics collection',
        status:
          metricsStatus === 'available'
            ? 'healthy'
            : metricsStatus === 'partial'
              ? 'degraded'
              : 'unavailable',
        message:
          metricsStatus === 'available'
            ? `Updated ${generatedAt.toISOString()}`
            : `${metricsStatus} metrics response`,
      },
      this.thresholdCheck(
        'Scheduled jobs',
        summaries.maxScheduledJobLagSeconds,
        60,
        'seconds peak lag',
      ),
      this.queueHealthCheck(
        summaries.peakQueued,
        summaries.queuedBucketPercentage,
      ),
      this.thresholdCheck(
        'Function failures',
        summaries.maxFailurePercentage,
        5,
        '% peak failure rate',
      ),
    ];
  }

  private queueHealthCheck(
    peakQueued: number | null,
    queuedBucketPercentage: number | null,
  ): ConvexHealthCheck {
    if (peakQueued === null || queuedBucketPercentage === null) {
      return {
        name: 'Function queue',
        status: 'degraded',
        message: 'No data in this window',
      };
    }
    const persistentPressure = peakQueued >= 10 || queuedBucketPercentage >= 20;
    return {
      name: 'Function queue',
      status: persistentPressure ? 'degraded' : 'healthy',
      message:
        peakQueued === 0
          ? 'No queued executions observed'
          : `${peakQueued.toFixed(0)} peak queued; active in ${queuedBucketPercentage.toFixed(1)}% of buckets`,
      value: peakQueued,
      unit: 'peak queued functions',
    };
  }

  private thresholdCheck(
    name: string,
    value: number | null,
    threshold: number,
    unit: string,
  ): ConvexHealthCheck {
    if (value === null) {
      return { name, status: 'degraded', message: 'No data in this window' };
    }
    return {
      name,
      status: value > threshold ? 'degraded' : 'healthy',
      message: `${value.toFixed(1)} ${unit}`,
      value,
      unit,
    };
  }

  private buildInsights(
    summaries: OperationalMetrics['summaries'],
    functionCalls: NamedMetricSeries[],
    failureRates: NamedMetricSeries[],
    cacheRates: NamedMetricSeries[],
    invalidations: NamedMetricSeries[],
    rangeMinutes: number,
  ): ConvexInsight[] {
    const insights: ConvexInsight[] = [];
    const ranked = (series: NamedMetricSeries[], mode: 'max' | 'sum') =>
      series
        .filter(({ name }) => name !== '_rest')
        .map((item) => ({
          name: item.name,
          value:
            mode === 'sum'
              ? (this.sumSeries([item]) ?? 0)
              : (this.maxSeries([item]) ?? 0),
        }))
        .sort((a, b) => b.value - a.value);

    const topFailure = ranked(failureRates, 'max')[0];
    if (topFailure && topFailure.value > 5) {
      insights.push({
        severity: 'critical',
        category: 'reliability',
        title: 'Elevated function failures',
        description: `${topFailure.name} exceeded the 5% failure threshold.`,
        evidence: `${topFailure.value.toFixed(1)}% peak failure rate`,
        impact: 'Requests may be failing for users or triggering retries.',
        recommendation:
          'Review this function’s recent logs and errors, then verify its dependencies.',
      });
    }

    const callTotals = new Map(
      ranked(functionCalls, 'sum').map(({ name, value }) => [name, value]),
    );
    const lowCache = cacheRates
      .filter(({ name }) => (callTotals.get(name) ?? 0) >= 20)
      .map((item) => ({
        name: item.name,
        value: Math.min(
          ...this.numericValues([item]),
          Number.POSITIVE_INFINITY,
        ),
      }))
      .filter(({ value }) => Number.isFinite(value) && value < 60)
      .sort((a, b) => a.value - b.value)[0];
    if (lowCache) {
      insights.push({
        severity: 'warning',
        category: 'performance',
        title: 'Low cache efficiency',
        description: `${lowCache.name} fell below the 60% cache-hit threshold with meaningful traffic.`,
        evidence: `${lowCache.value.toFixed(1)}% minimum cache hits across ${callTotals.get(lowCache.name)?.toFixed(0)} calls`,
        impact:
          'More executions may consume compute and increase response latency.',
        recommendation:
          'Check whether arguments or frequently changing dependencies prevent query reuse.',
      });
    }

    const topInvalidations = ranked(invalidations, 'sum')[0];
    const invalidationsPerMinute = topInvalidations
      ? topInvalidations.value / rangeMinutes
      : 0;
    if (topInvalidations && invalidationsPerMinute > 25) {
      insights.push({
        severity: 'warning',
        category: 'performance',
        title: 'Subscription invalidation hotspot',
        description: `${topInvalidations.name} generated a high sustained invalidation rate.`,
        evidence: `${invalidationsPerMinute.toFixed(1)} invalidations/minute`,
        impact:
          'Subscribed clients may re-run queries more often than expected.',
        recommendation:
          'Review write frequency and narrow reactive query dependencies where possible.',
      });
    }

    const queueIsPersistent =
      (summaries.peakQueued ?? 0) >= 10 ||
      (summaries.queuedBucketPercentage ?? 0) >= 20;
    insights.push({
      severity: queueIsPersistent ? 'warning' : 'info',
      category: 'capacity',
      title: queueIsPersistent
        ? 'Sustained queue pressure detected'
        : 'No sustained capacity pressure',
      description: queueIsPersistent
        ? 'Queued work was large or present across a significant part of the selected window.'
        : 'Running executions stayed within the deployment’s observed ability to serve this workload.',
      evidence: `${(summaries.peakRunning ?? 0).toFixed(0)} peak running · ${(summaries.peakQueued ?? 0).toFixed(0)} peak queued · ${(summaries.queuedBucketPercentage ?? 0).toFixed(1)}% queued buckets`,
      impact:
        'Peak running is observed concurrency, not a configured capacity limit. Scale concern begins when queues persist and latency or failures also rise.',
      recommendation: queueIsPersistent
        ? 'Correlate queue duration with latency and failures, then reduce bursty work or increase deployment resources.'
        : 'No scaling action is indicated; continue monitoring queue persistence as traffic grows.',
    });

    if ((summaries.maxScheduledJobLagSeconds ?? 0) > 60) {
      insights.push({
        severity: 'warning',
        category: 'reliability',
        title: 'Scheduler lag detected',
        description: 'Scheduled jobs started more than 60 seconds late.',
        evidence: `${summaries.maxScheduledJobLagSeconds?.toFixed(1)} seconds peak lag`,
        impact:
          'Time-sensitive background work may complete later than expected.',
        recommendation:
          'Inspect overlapping jobs and function duration around the lag spike.',
      });
    }

    const busiest = ranked(functionCalls, 'sum')[0];
    if (busiest) {
      insights.push({
        severity: 'info',
        category: 'activity',
        title: 'Busiest function',
        description: `${busiest.name} handled the most calls in the selected window.`,
        evidence: `${busiest.value.toFixed(0)} calls · ${(summaries.averageCallsPerMinute ?? 0).toFixed(2)} deployment calls/minute`,
        impact:
          'This function currently contributes the largest share of request activity.',
        recommendation:
          'Use it as the first function to review when optimizing high-volume workloads.',
      });
    }

    return insights;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown metrics error';
  }

  private emptyOperationalMetrics(
    generatedAt: Date,
    rangeMinutes: number,
    bucketCount: number,
    bucketMinutes: number,
    message: string,
  ): OperationalMetrics {
    return {
      generatedAt: generatedAt.toISOString(),
      rangeMinutes,
      bucketCount,
      bucketMinutes,
      status: 'unavailable',
      errors: [{ metric: 'configuration', message }],
      functionCalls: [],
      failurePercentages: [],
      cacheHitPercentages: [],
      subscriptionInvalidations: [],
      scheduledJobLag: [],
      concurrency: { running: [], queued: [] },
      summaries: {
        totalCalls: null,
        maxFailurePercentage: null,
        averageCacheHitPercentage: null,
        maxScheduledJobLagSeconds: null,
        peakRunning: null,
        peakQueued: null,
        averageCallsPerMinute: null,
        queuedBucketPercentage: null,
      },
      health: {
        status: 'unavailable',
        checks: [
          {
            name: 'Configuration',
            status: 'unavailable',
            message,
          },
        ],
      },
      insights: [],
    };
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
