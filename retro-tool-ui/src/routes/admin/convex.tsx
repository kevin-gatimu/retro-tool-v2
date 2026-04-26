import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { RefreshCw, Zap, AlertCircle } from 'lucide-react'
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
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isSuperAdmin } from '@/lib/rbac'
import { AdminNav } from './helpers'
import {
  useConvexOperationalMetrics,
  useConvexUsageMetrics,
  useConvexCronConfig,
  useUpdateCronConfig,
  useClearConvexTables,
} from './hooks'

export const Route = createFileRoute('/admin/convex')({
  beforeLoad: ({ context }) => {
    // queryClient context exists but no auth — guard handled in component
    void context
  },
  component: ConvexAdminPage,
})

// ─── Tables ────────────────────────────────────────────────────────────────

const CONVEX_TABLES = [
  { name: 'liveRetroSessions', label: 'Live Retro Sessions' },
  { name: 'liveEstimateSessions', label: 'Live Estimate Sessions' },
  { name: 'liveRetroBoards', label: 'Live Retro Boards' },
  { name: 'liveEstimateBoards', label: 'Live Estimate Boards' },
  { name: 'liveNotifications', label: 'Live Notifications' },
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function pct(used: number, quota: number) {
  if (quota === 0) return 0
  return Math.min(100, Math.round((used / quota) * 100))
}

// ─── Metrics Tab ───────────────────────────────────────────────────────────

function MetricsTab() {
  const opQuery = useConvexOperationalMetrics()
  const usageQuery = useConvexUsageMetrics()

  const op = opQuery.data
  const usage = usageQuery.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Operational Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Real-time Convex backend metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => opQuery.refetch()}
          disabled={opQuery.isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${opQuery.isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {opQuery.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load operational metrics. Ensure the Convex backend is
            reachable.
          </AlertDescription>
        </Alert>
      )}

      {op && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cache Hit %</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {op.cacheHitPercentage != null
                    ? `${op.cacheHitPercentage.toFixed(1)}%`
                    : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>P50 Latency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {op.latencyPercentiles != null
                    ? `${op.latencyPercentiles.p50.toFixed(0)} ms`
                    : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>P95 Latency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {op.latencyPercentiles != null
                    ? `${op.latencyPercentiles.p95.toFixed(0)} ms`
                    : '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Concurrency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {op.functionConcurrency != null
                    ? op.functionConcurrency
                    : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top functions */}
          {op.topFunctions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top Functions (by calls)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {op.topFunctions.slice(0, 10).map((fn) => (
                    <div
                      key={fn.identifier}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-xs truncate max-w-[70%]">
                        {fn.identifier}
                      </span>
                      <Badge variant="secondary">
                        {fn.calls.toLocaleString()} calls
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table I/O rates */}
          {op.tableRates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Table I/O Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {op.tableRates.map((t) => (
                    <div
                      key={t.tableName}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="font-mono text-xs">{t.tableName}</span>
                      <div className="flex gap-4 text-muted-foreground">
                        <span>↑ {t.reads.toLocaleString()} reads</span>
                        <span>↓ {t.writes.toLocaleString()} writes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled job lag */}
          {op.scheduledJobLag != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Scheduled Job Lag</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {op.scheduledJobLag.toFixed(0)} ms
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Billing / Cloud usage */}
      {usage && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold">Convex Cloud Usage</h3>
            <p className="text-sm text-muted-foreground">
              Billing metrics from Convex Cloud
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {usage.functionCalls && (
              <UsageCard
                label="Function Calls"
                used={usage.functionCalls.used}
                quota={usage.functionCalls.quota}
                format={(n) => n.toLocaleString()}
              />
            )}
            {usage.actionCompute && (
              <UsageCard
                label="Action Compute"
                used={usage.actionCompute.used}
                quota={usage.actionCompute.quota}
                format={(n) => `${n.toLocaleString()} ms`}
              />
            )}
            {usage.databaseStorage && (
              <UsageCard
                label="Database Storage"
                used={usage.databaseStorage.used}
                quota={usage.databaseStorage.quota}
                format={formatBytes}
              />
            )}
            {usage.databaseBandwidth && (
              <UsageCard
                label="Database Bandwidth"
                used={usage.databaseBandwidth.used}
                quota={usage.databaseBandwidth.quota}
                format={formatBytes}
              />
            )}
            {usage.fileStorage && (
              <UsageCard
                label="File Storage"
                used={usage.fileStorage.used}
                quota={usage.fileStorage.quota}
                format={formatBytes}
              />
            )}
            {usage.fileBandwidth && (
              <UsageCard
                label="File Bandwidth"
                used={usage.fileBandwidth.used}
                quota={usage.fileBandwidth.quota}
                format={formatBytes}
              />
            )}
            {usage.vectorStorage && (
              <UsageCard
                label="Vector Storage"
                used={usage.vectorStorage.used}
                quota={usage.vectorStorage.quota}
                format={formatBytes}
              />
            )}
            {usage.vectorBandwidth && (
              <UsageCard
                label="Vector Bandwidth"
                used={usage.vectorBandwidth.used}
                quota={usage.vectorBandwidth.quota}
                format={formatBytes}
              />
            )}
            {usage.deployments && (
              <UsageCard
                label="Deployments"
                used={usage.deployments.used}
                quota={usage.deployments.quota}
                format={(n) => n.toLocaleString()}
              />
            )}
            {usage.chefTokens && (
              <UsageCard
                label="Chef Tokens"
                used={usage.chefTokens.used}
                quota={usage.chefTokens.quota}
                format={(n) => n.toLocaleString()}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function UsageCard({
  label,
  used,
  quota,
  format,
}: {
  label: string
  used: number
  quota: number
  format: (n: number) => string
}) {
  const percentage = pct(used, quota)
  const isHigh = percentage >= 80

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className="text-xl font-bold">{format(used)}</div>
          <Badge variant={isHigh ? 'destructive' : 'secondary'}>
            {percentage}%
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          of {format(quota)} quota
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isHigh ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
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
      <div className="p-6">
        <AdminNav />
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
    <div className="p-6">
      <AdminNav />

      <div className="flex items-center gap-2 mb-6">
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
          <TabsTrigger value="table-management">Table Management</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-6">
          <MetricsTab />
        </TabsContent>

        <TabsContent value="table-management" className="mt-6">
          <TableManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
