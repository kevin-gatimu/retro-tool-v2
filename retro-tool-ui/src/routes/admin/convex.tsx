import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  HeartPulse,
  Lightbulb,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isSuperAdmin } from '@/lib/rbac'

import {
  useConvexOperationalMetrics,
  useConvexCronConfig,
  useUpdateCronConfig,
  useClearConvexTables,
} from './hooks'
import { ConvexMetricsChart } from './components/convex-metrics-chart'
import { ConvexAdminSkeleton } from './skeleton'

export const Route = createFileRoute('/admin/convex')({
  beforeLoad: ({ context }) => {
    // queryClient context exists but no auth — guard handled in component
    void context
  },
  pendingComponent: ConvexAdminSkeleton,
  component: ConvexAdminPage,
})

// ─── Tables ────────────────────────────────────────────────────────────────

// Mirrors the CLEARABLE_TABLES allowlist in convex-backend/convex/admin.ts.
// liveTeamMembers is deliberately excluded: it is the security/membership
// projection all Convex authz depends on, so it must not be one-click or
// schedule-cleared (it is kept fresh by reconciliation + the nightly self-heal).
const CONVEX_TABLES = [
  { name: 'liveRetroSessions', label: 'Live Retro Sessions' },
  { name: 'liveEstimateSessions', label: 'Live Estimate Sessions' },
  { name: 'liveIcebreakerSessions', label: 'Live Icebreaker Sessions' },
  { name: 'liveRetroBoards', label: 'Live Retro Boards' },
  { name: 'liveEstimateBoards', label: 'Live Estimate Boards' },
  { name: 'liveIcebreakerBoards', label: 'Live Icebreaker Boards' },
  { name: 'liveStandupEntries', label: 'Live Standup Entries' },
  { name: 'liveStandupBoards', label: 'Live Standup Boards' },
  { name: 'liveNotifications', label: 'Live Notifications' },
  { name: 'livePolls', label: 'Live Polls' },
  { name: 'liveSurveys', label: 'Live Surveys' },
  { name: 'livePresence', label: 'Live Presence' },
  { name: 'liveTyping', label: 'Live Typing' },
  { name: 'liveReadyStatus', label: 'Live Ready Status' },
] as const

type ConvexTableName = (typeof CONVEX_TABLES)[number]['name']

// ─── Schedule presets ──────────────────────────────────────────────────────

type SchedulePreset = 'hourly' | 'daily' | 'weekly' | 'custom'

const SCHEDULE_PRESETS: {
  value: SchedulePreset
  label: string
  cron: string
}[] = [
  { value: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { value: 'daily', label: 'Daily (midnight)', cron: '0 0 * * *' },
  { value: 'weekly', label: 'Weekly (Sunday midnight)', cron: '0 0 * * 0' },
  { value: 'custom', label: 'Custom', cron: '' },
]

function cronToPreset(cron: string): SchedulePreset {
  const found = SCHEDULE_PRESETS.find((p) => p.cron === cron)
  return found ? found.value : 'custom'
}

// ─── Metrics, health, and insights ───────────────────────────────────────────

function formatMetric(value: number | null, suffix = '') {
  return value == null
    ? '—'
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`
}

function MetricSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function MetricsTab() {
  const [rangeMinutes, setRangeMinutes] = useState(60)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const query = useConvexOperationalMetrics(rangeMinutes, pollingEnabled)
  const metrics = query.data
  const lagSeries = metrics
    ? [{ name: 'Scheduled job lag', points: metrics.scheduledJobLag }]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Operational Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Deployment metrics proxied securely through the API
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(rangeMinutes)}
            onValueChange={(value) => setRangeMinutes(Number(value))}
          >
            <SelectTrigger className="w-32" aria-label="Metrics time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Last 15 min</SelectItem>
              <SelectItem value="60">Last hour</SelectItem>
              <SelectItem value="360">Last 6 hours</SelectItem>
              <SelectItem value="1440">Day</SelectItem>
              <SelectItem value="10080">Week</SelectItem>
              <SelectItem value="43200">Month</SelectItem>
              <SelectItem value="129600">Quarter</SelectItem>
              <SelectItem value="525600">Year</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="metrics-polling"
              checked={pollingEnabled}
              onCheckedChange={setPollingEnabled}
            />
            <Label htmlFor="metrics-polling" className="text-xs">
              Auto-refresh
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {query.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load operational metrics. Ensure the Convex deployment is
            reachable.
          </AlertDescription>
        </Alert>
      )}

      {metrics?.status === 'partial' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some metric series are unavailable:{' '}
            {metrics.errors.map((error) => error.metric).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {metrics && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
            <MetricSummaryCard
              label="Function calls"
              value={formatMetric(metrics.summaries.totalCalls)}
            />
            <MetricSummaryCard
              label="Avg calls / min"
              value={formatMetric(metrics.summaries.averageCallsPerMinute)}
            />
            <MetricSummaryCard
              label="Peak failure rate"
              value={formatMetric(metrics.summaries.maxFailurePercentage, '%')}
            />
            <MetricSummaryCard
              label="Average cache hits"
              value={formatMetric(
                metrics.summaries.averageCacheHitPercentage,
                '%',
              )}
            />
            <MetricSummaryCard
              label="Peak scheduler lag"
              value={formatMetric(
                metrics.summaries.maxScheduledJobLagSeconds,
                ' s',
              )}
            />
            <MetricSummaryCard
              label="Peak running (observed)"
              value={formatMetric(metrics.summaries.peakRunning)}
            />
            <MetricSummaryCard
              label="Peak queued"
              value={formatMetric(metrics.summaries.peakQueued)}
            />
            <MetricSummaryCard
              label="Buckets w/ queueing"
              value={formatMetric(
                metrics.summaries.queuedBucketPercentage,
                '%',
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            &quot;Peak running&quot; reflects the highest concurrency{' '}
            <em>observed</em> in this window — it is not a configured capacity
            limit, so it should not be read as a hard ceiling.
          </p>

          <div className="grid gap-6 xl:grid-cols-2">
            <ConvexMetricsChart
              title="Function calls"
              description="Calls per function and time bucket"
              series={metrics.functionCalls}
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Failure percentage"
              description="Peak error rate by function"
              series={metrics.failurePercentages}
              valueSuffix="%"
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Cache hit percentage"
              description="Query cache efficiency by function"
              series={metrics.cacheHitPercentages}
              valueSuffix="%"
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Scheduled job lag"
              description="Delay before scheduled functions start"
              series={lagSeries}
              valueSuffix=" s"
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Running functions (observed concurrency)"
              description="Concurrent executions by function type — reflects observed load, not a configured capacity limit"
              series={metrics.concurrency.running}
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Queued functions"
              description="Executions waiting for capacity"
              series={metrics.concurrency.queued}
              rangeMinutes={rangeMinutes}
            />
            <ConvexMetricsChart
              title="Subscription invalidations"
              description="Reactive query invalidations by function"
              series={metrics.subscriptionInvalidations}
              rangeMinutes={rangeMinutes}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(metrics.generatedAt).toLocaleString()} ·{' '}
            {metrics.bucketCount} buckets of {metrics.bucketMinutes} min each
          </p>
        </>
      )}
    </div>
  )
}

function HealthTab() {
  const query = useConvexOperationalMetrics()
  const health = query.data?.health

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Unable to evaluate Convex health.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HeartPulse className="h-5 w-5" />
        <div>
          <h3 className="text-lg font-semibold">Deployment Health</h3>
          <p className="text-sm text-muted-foreground">
            Connectivity, metric availability, scheduler, queue, and failure
            signals
          </p>
        </div>
        {health && (
          <Badge
            className="ml-auto"
            variant={health.status === 'healthy' ? 'default' : 'destructive'}
          >
            {health.status}
          </Badge>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {health?.checks.map((check) => (
          <Card key={check.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{check.name}</CardTitle>
                <Badge
                  variant={
                    check.status === 'healthy' ? 'secondary' : 'destructive'
                  }
                >
                  {check.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {check.message}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function formatRangeLabel(rangeMinutes: number) {
  if (rangeMinutes < 60) return `Last ${rangeMinutes} min`
  if (rangeMinutes === 60) return 'Last hour'
  if (rangeMinutes < 1440) return `Last ${Math.round(rangeMinutes / 60)} hours`
  if (rangeMinutes === 1440) return 'Day'
  if (rangeMinutes === 10_080) return 'Week'
  if (rangeMinutes === 43_200) return 'Month'
  if (rangeMinutes === 129_600) return 'Quarter'
  if (rangeMinutes === 525_600) return 'Year'
  return `Last ${Math.round(rangeMinutes / 1440)} days`
}

const SEVERITY_BADGE_VARIANT: Record<
  'info' | 'warning' | 'critical',
  'secondary' | 'default' | 'destructive'
> = {
  info: 'secondary',
  warning: 'default',
  critical: 'destructive',
}

function InsightsTab() {
  const [rangeMinutes, setRangeMinutes] = useState(1440)
  const query = useConvexOperationalMetrics(rangeMinutes)
  const insights = query.data?.insights ?? []
  const windowLabel = formatRangeLabel(rangeMinutes)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-5 w-5" />
          <div>
            <h3 className="text-lg font-semibold">Deployment Insights</h3>
            <p className="text-sm text-muted-foreground">
              Deterministic observations derived from the selected metrics
              window
            </p>
          </div>
        </div>
        <Select
          value={String(rangeMinutes)}
          onValueChange={(value) => setRangeMinutes(Number(value))}
        >
          <SelectTrigger className="w-32" aria-label="Insights time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1440">Day</SelectItem>
            <SelectItem value="10080">Week</SelectItem>
            <SelectItem value="43200">Month</SelectItem>
            <SelectItem value="129600">Quarter</SelectItem>
            <SelectItem value="525600">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight) => (
          <Card key={`${insight.category}-${insight.title}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {insight.severity === 'info' ? (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {insight.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {insight.category}
                  </Badge>
                  <Badge variant={SEVERITY_BADGE_VARIANT[insight.severity]}>
                    {insight.severity}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-foreground">{insight.description}</p>
              <div>
                <span className="font-medium text-muted-foreground">
                  Evidence:{' '}
                </span>
                <span className="text-muted-foreground">
                  {insight.evidence}
                </span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Impact:{' '}
                </span>
                <span className="text-muted-foreground">{insight.impact}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">
                  Recommendation:{' '}
                </span>
                <span className="text-muted-foreground">
                  {insight.recommendation}
                </span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Window: {windowLabel}
              </p>
            </CardContent>
          </Card>
        ))}
        {!query.isLoading && insights.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No insights are available.
          </p>
        )}
      </div>
    </div>
  )
}
// ─── Table Management Tab ──────────────────────────────────────────────────

function TableManagementTab() {
  const cronQuery = useConvexCronConfig()
  const updateCron = useUpdateCronConfig()
  const clearTables = useClearConvexTables()

  const [selectedTables, setSelectedTables] = useState<Set<ConvexTableName>>(
    new Set(),
  )
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('weekly')
  const [customCron, setCustomCron] = useState('0 0 * * 0')
  const [cronEnabled, setCronEnabled] = useState(false)
  const [cronTables, setCronTables] = useState<Set<ConvexTableName>>(new Set())
  const [cronInitialised, setCronInitialised] = useState(false)

  // Sync local state from fetched config on first load
  if (cronQuery.data && !cronInitialised) {
    const cfg = cronQuery.data
    setCronEnabled(cfg.enabled)
    const preset = cronToPreset(cfg.schedule)
    setSchedulePreset(preset)
    if (preset === 'custom') setCustomCron(cfg.schedule)
    setCronTables(new Set(cfg.tablesToClear as ConvexTableName[]))
    setCronInitialised(true)
  }

  function toggleTable(name: ConvexTableName) {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleCronTable(name: ConvexTableName) {
    setCronTables((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function handleClearNow() {
    if (selectedTables.size === 0) {
      toast.error('Select at least one table to clear.')
      return
    }
    clearTables.mutate(
      { tableNames: Array.from(selectedTables) },
      {
        onSuccess: (data) => {
          toast.success(
            `Cleared ${data.cleared.length} table(s): ${data.cleared.join(', ')}`,
          )
          setSelectedTables(new Set())
        },
        onError: () => {
          toast.error('Failed to clear tables. Check the console for details.')
        },
      },
    )
  }

  function handleSaveSchedule() {
    const schedule =
      schedulePreset === 'custom'
        ? customCron
        : (SCHEDULE_PRESETS.find((p) => p.value === schedulePreset)?.cron ??
          '0 0 * * 0')

    updateCron.mutate(
      {
        schedule,
        enabled: cronEnabled,
        tablesToClear: Array.from(cronTables),
      },
      {
        onSuccess: () => {
          toast.success('Cron schedule saved.')
        },
        onError: () => {
          toast.error('Failed to save schedule.')
        },
      },
    )
  }

  return (
    <div className="space-y-8">
      {/* Manual clear section */}
      <Card>
        <CardHeader>
          <CardTitle>Clear Tables Now</CardTitle>
          <CardDescription>
            Immediately delete all documents from the selected Convex tables.
            This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CONVEX_TABLES.map((table) => (
              <div key={table.name} className="flex items-center gap-2">
                <Checkbox
                  id={`clear-${table.name}`}
                  checked={selectedTables.has(table.name)}
                  onCheckedChange={() => toggleTable(table.name)}
                />
                <Label
                  htmlFor={`clear-${table.name}`}
                  className="text-sm cursor-pointer"
                >
                  {table.label}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="destructive"
              disabled={selectedTables.size === 0 || clearTables.isPending}
              onClick={handleClearNow}
            >
              {clearTables.isPending
                ? 'Clearing…'
                : `Clear Selected (${selectedTables.size})`}
            </Button>
            {selectedTables.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTables(new Set())}
              >
                Clear selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Scheduled cron section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Cleanup</CardTitle>
              <CardDescription>
                Automatically clear selected tables on a recurring schedule.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="cron-enabled" className="text-sm">
                {cronEnabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                id="cron-enabled"
                checked={cronEnabled}
                onCheckedChange={setCronEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tables to clear on schedule */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tables to clear on schedule
            </Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {CONVEX_TABLES.map((table) => (
                <div key={table.name} className="flex items-center gap-2">
                  <Checkbox
                    id={`cron-${table.name}`}
                    checked={cronTables.has(table.name)}
                    onCheckedChange={() => toggleCronTable(table.name)}
                    disabled={!cronEnabled}
                  />
                  <Label
                    htmlFor={`cron-${table.name}`}
                    className={`text-sm cursor-pointer ${!cronEnabled ? 'text-muted-foreground' : ''}`}
                  >
                    {table.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule preset */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-sm font-medium">Frequency</Label>
              <Select
                value={schedulePreset}
                onValueChange={(v) => setSchedulePreset(v as SchedulePreset)}
                disabled={!cronEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                      {p.cron && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          ({p.cron})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {schedulePreset === 'custom' && (
              <div className="space-y-1 flex-1">
                <Label htmlFor="custom-cron" className="text-sm font-medium">
                  Cron expression
                </Label>
                <Input
                  id="custom-cron"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="* * * * *"
                  disabled={!cronEnabled}
                  className="font-mono"
                />
              </div>
            )}
          </div>

          {/* Current config display */}
          {cronQuery.data && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">Current schedule:</span>{' '}
                <span className="font-mono">{cronQuery.data.schedule}</span>{' '}
                <Badge
                  variant={cronQuery.data.enabled ? 'default' : 'secondary'}
                  className="ml-1 text-xs"
                >
                  {cronQuery.data.enabled ? 'active' : 'inactive'}
                </Badge>
              </div>
              {cronQuery.data.tablesToClear.length > 0 && (
                <div>
                  <span className="font-medium">Clears:</span>{' '}
                  {cronQuery.data.tablesToClear.join(', ')}
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSaveSchedule} disabled={updateCron.isPending}>
            {updateCron.isPending ? 'Saving…' : 'Save Schedule'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

function ConvexAdminPage() {
  const { data: currentUser } = useCurrentUser()

  if (!isSuperAdmin(currentUser?.role)) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Convex Admin</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage your Convex realtime backend
          </p>
        </div>
      </div>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="table-management">Table Management</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-6">
          <MetricsTab />
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <HealthTab />
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <InsightsTab />
        </TabsContent>

        <TabsContent value="table-management" className="mt-6">
          <TableManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
