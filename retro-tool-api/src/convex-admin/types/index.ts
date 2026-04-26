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
