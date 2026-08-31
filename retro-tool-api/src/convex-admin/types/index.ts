import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type * as adminSchema from '../schema';

/**
 * A Drizzle executor that is either the shared connection or an open
 * transaction, so the outbox can enqueue a projection event in the same
 * PostgreSQL transaction as a business write.
 */
export type OutboxExecutor =
  | NodePgDatabase<typeof adminSchema>
  | PgTransaction<never, typeof adminSchema, never>;

export type OperationalMetrics = {
  topFunctions: Array<{ identifier: string; calls: number }>;
  cacheHitPercentage: number | null;
  latencyPercentiles: { p50: number; p95: number; p99: number } | null;
  scheduledJobLag: number | null;
  functionConcurrency: number | null;
  tableRates: Array<{ tableName: string; reads: number; writes: number }>;
};

export type UsageMetrics = {
  functionCalls: { used: number; quota: number } | null;
  actionCompute: { used: number; quota: number } | null;
  databaseStorage: { used: number; quota: number } | null;
  databaseBandwidth: { used: number; quota: number } | null;
  fileStorage: { used: number; quota: number } | null;
  fileBandwidth: { used: number; quota: number } | null;
  vectorStorage: { used: number; quota: number } | null;
  vectorBandwidth: { used: number; quota: number } | null;
  deployments: { used: number; quota: number } | null;
  chefTokens: { used: number; quota: number } | null;
};

export type ConvexCronConfigResponse = {
  id: string;
  schedule: string;
  enabled: boolean;
  tablesToClear: string[];
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type ConvexMutationResponse = {
  status?: unknown;
  errorMessage?: unknown;
  value?: unknown;
};

// ── Projection outbox ────────────────────────────────────────────────────────

/**
 * One prunable projection for the reconciliation orchestrator: its logical
 * name, the Convex table to mark-and-sweep (or `null` when it is swept by its
 * own rebuild or must not be pruned), and the rebuild function that returns the
 * number of source rows scanned.
 */
export type ProjectionTask = {
  projection: string;
  pruneTable: string | null;
  rebuild: () => Promise<{ scanned: number }>;
};

/** What a projection outbox event asks the dispatcher to do with an entity. */
export type ProjectionOutboxOperation = 'sync' | 'delete';

/**
 * A durable intent to (re)project or delete one entity. The dispatcher routes
 * it to the matching projection-sync handler, which recomputes current
 * PostgreSQL state and pushes it to Convex — so delivery always converges to
 * truth and is safe to retry.
 */
export type ProjectionOutboxEvent = {
  projection: string;
  operation: ProjectionOutboxOperation;
  /** Source entity id; composite keys are colon-joined (e.g. `<standupId>:<date>`). */
  entityKey: string;
  /** Optional extra data the handler needs (e.g. notification read-state). */
  payload?: Record<string, unknown>;
};

/**
 * Delivers one projection intent by recomputing current state from PostgreSQL
 * and pushing to Convex. Registered per projection by the dispatcher. Must
 * throw on failure so the outbox can retry.
 */
export type ProjectionOutboxHandler = (
  operation: ProjectionOutboxOperation,
  entityKey: string,
  payload: Record<string, unknown> | null,
) => Promise<void>;

/** Result of one dispatcher drain pass. */
export type OutboxDispatchResult = {
  dispatched: number;
  failed: number;
  skippedSuperseded: number;
  remaining: number;
};

export type OutboxStatusResponse = {
  paused: boolean;
  pending: number;
  failed: number;
  oldestPendingAgeMs: number | null;
  updatedAt: string | null;
};

// ── Full projection reconciliation ───────────────────────────────────────────

/** Per-projection outcome of a full reconciliation run. */
export type ProjectionReconcileReport = {
  projection: string;
  scanned: number;
  deletedStale: number;
  failed: number;
  durationMs: number;
  error?: string;
};

export type ReconcileAllResponse = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  reports: ProjectionReconcileReport[];
};
