import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Layers,
  Minus,
  RefreshCw,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import { useState, lazy, Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MyStatsSkeleton,
  OrgTabSkeleton,
  ReportsSkeleton,
  SystemTabSkeleton,
  TeamsTabSkeleton,
} from '@/components/skeletons'
import type { Team } from '@/common/types/teams'
import type { Organization } from '@/common/types/organizations'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  REPORTS_ENDPOINTS,
  TEAMS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'

// Lazy load chart component
const ActionItemsPieChart = lazy(() =>
  import('@/components/ActionItemsPieChart').then((module) => ({
    default: module.ActionItemsPieChart,
  })),
)

// ─── Types ──────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter' | 'year'

type TeamMetrics = {
  retroCount: number
  avgParticipants: number
  participationRate: number
  totalCards: number
  totalVotes: number
  avgCardsPerRetro: number
  actionItemsCompleted: number
  actionItemsPending: number
}

type HealthScore = {
  score: number
  description: string
  trend: 'increasing' | 'decreasing' | 'stable'
  participationPoints: number
  engagementPoints: number
  completionPoints: number | null
  frequencyPoints: number
}

type ActionItemAnalytics = {
  completed: number
  pending: number
  overdue: number
  completionRate: number
  topAssignees: Array<{
    userId: string
    userName: string
    assignedCount: number
    completedCount: number
  }>
}

type EstimateKPIs = {
  sessionsCompleted: number
  storiesEstimated: number
  participationRate: number
  avgVotesPerStory: number
}

type UserStats = {
  teamsCount: number
  retroCount: number
  cardsCreated: number
  actionItemsAssigned: number
  actionItemsCompleted: number
  completionRate: number
}

type OrgOverview = {
  teamsCount: number
  membersCount: number
  retroCount: number
  totalCards: number
  totalVotes: number
  participationRate: number
  actionItemsCompleted: number
  actionItemsPending: number
  teamBreakdown: Array<{
    teamId: string
    teamName: string
    retroCount: number
    memberCount: number
    participationRate: number
  }>
  teamBreakdownTotal: number
  teamBreakdownPage: number
  teamBreakdownLimit: number
  teamBreakdownTotalPages: number
}

type SystemOverview = {
  orgsCount: number
  teamsCount: number
  usersCount: number
  retroCount: number
  totalCards: number
  orgBreakdown: Array<{
    orgId: string
    orgName: string
    teamsCount: number
    membersCount: number
    retroCount: number
  }>
  orgBreakdownTotal: number
  orgBreakdownPage: number
  orgBreakdownLimit: number
  orgBreakdownTotalPages: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toNum = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function barColor(value: number, max: number): string {
  const pct = max > 0 ? value / max : 0
  if (pct >= 0.75) return 'bg-green-500'
  if (pct >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function openPrintWindow(title: string, contentHtml: string): void {
  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map((node) => node.outerHTML)
    .join('\n')

  const popup = window.open('', '_blank', 'width=1200,height=900')
  if (!popup) return

  popup.document.open()
  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${styles}
        <style>
          body { margin: 24px; }
          @page { size: A4; margin: 12mm; }
          table {
            border-collapse: collapse;
            width: 100%;
            border: 1px solid #d1d5db;
          }
          th, td {
            border-bottom: 1px solid #d1d5db;
            border-right: 1px solid #d1d5db;
            text-align: left;
            padding: 8px 12px;
          }
          th:last-child, td:last-child { border-right: 0; }
          thead th {
            background: #f8fafc;
            font-weight: 600;
          }
          .export-card-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .export-card {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .export-card-label {
            color: #475569;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .export-card-value {
            font-size: 16px;
            font-weight: 600;
            color: #0f172a;
          }
        </style>
      </head>
      <body>
        <h1 style="font-size: 20px; margin: 0 0 12px;">${title}</h1>
        ${contentHtml}
      </body>
    </html>
  `)
  popup.document.close()

  const runPrint = () => {
    popup.focus()
    popup.print()
  }

  popup.addEventListener('afterprint', () => {
    popup.close()
  })

  popup.addEventListener('load', () => {
    if ('fonts' in popup.document) {
      popup.document.fonts.ready
        .then(() => {
          window.setTimeout(runPrint, 150)
        })
        .catch(() => {
          window.setTimeout(runPrint, 150)
        })
      return
    }
    window.setTimeout(runPrint, 150)
  })
}

function exportSectionToPdf(sectionId: string, title: string): void {
  const section = document.getElementById(sectionId)
  if (!section) return

  const clonedSection = section.cloneNode(true) as HTMLElement
  clonedSection
    .querySelectorAll('[data-export-exclude="true"]')
    .forEach((node) => node.remove())

  const contentHtml = clonedSection.outerHTML
  openPrintWindow(title, contentHtml)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </CardContent>
      )}
    </Card>
  )
}

function ColorBar({
  label,
  description,
  value,
  max,
}: {
  label: string
  description: string
  value: number
  max: number
}) {
  const pct = Math.round((value / max) * 100)
  const color = barColor(value, max)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="min-w-0">
          <span className="font-medium">{label}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {description}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-medium">{pct}%</span>
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({value}/{max} pts)
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Route ───────────────────────────────────────────────────────────────────

const reportsTeamsQueryOptions = {
  queryKey: ['teams'] as const,
  queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
}

export const Route = createFileRoute('/reports')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(reportsTeamsQueryOptions),
  pendingComponent: ReportsSkeleton,
  component: ReportsPage,
})

// ─── Page ────────────────────────────────────────────────────────────────────

function ReportsPage() {
  const { data: teamsData } = useSuspenseQuery(reportsTeamsQueryOptions)
  const teams = teamsData.teams

  const { data: currentUser } = useCurrentUser()

  const { data: orgsData } = useQuery({
    queryKey: ['orgs-for-reports'],
    queryFn: () =>
      api
        .get<{ organizations: Organization[] }>(ORGANIZATIONS_ENDPOINTS.LIST)
        .then((r) => r.organizations),
    initialData: [],
  })
  const orgs = orgsData

  // ── Role derivation ────────────────────────────────────────────────────────
  const isSystemAdmin =
    currentUser?.role === 'super-admin' || currentUser?.role === 'system-admin'

  const orgAdminOrgs = orgs.filter(
    (o) => o.myRole === 'org-owner' || o.myRole === 'org-admin',
  )

  const showTeamsTab = teams.length > 0
  const showOrgTab = orgAdminOrgs.length > 0 || isSystemAdmin
  const showSystemTab = isSystemAdmin

  const defaultTab =
    teams.length === 0 && showSystemTab
      ? 'system'
      : teams.length === 0 && showOrgTab
        ? 'org'
        : 'me'

  if (teams.length === 0 && !showOrgTab && !showSystemTab) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Analytics and insights from your retrospectives
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">No teams found</CardTitle>
            <p className="text-center text-muted-foreground">
              Join a team to start seeing reports and analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Analytics and insights from your retrospectives
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="me">
            <User className="mr-1.5 h-3.5 w-3.5" />
            My Stats
          </TabsTrigger>
          {showTeamsTab && (
            <TabsTrigger value="teams">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Teams
            </TabsTrigger>
          )}
          {showOrgTab && (
            <TabsTrigger value="org">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Organization
            </TabsTrigger>
          )}
          {showSystemTab && (
            <TabsTrigger value="system">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              System
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="me" className="mt-4">
          <MyStatsTab />
        </TabsContent>

        {showTeamsTab && (
          <TabsContent value="teams" className="mt-4">
            <TeamsTab teams={teams} />
          </TabsContent>
        )}

        {showOrgTab && (
          <TabsContent value="org" className="mt-4">
            <OrgTab orgs={isSystemAdmin ? orgs : orgAdminOrgs} />
          </TabsContent>
        )}

        {showSystemTab && (
          <TabsContent value="system" className="mt-4">
            <SystemTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ─── My Stats Tab ─────────────────────────────────────────────────────────────

function MyStatsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['user-stats-me'],
    queryFn: () => api.get<UserStats>(REPORTS_ENDPOINTS.ME),
  })

  if (isLoading) {
    return <MyStatsSkeleton />
  }

  const stats = data
    ? {
        teamsCount: toNum(data.teamsCount),
        retroCount: toNum(data.retroCount),
        cardsCreated: toNum(data.cardsCreated),
        actionItemsAssigned: toNum(data.actionItemsAssigned),
        actionItemsCompleted: toNum(data.actionItemsCompleted),
        completionRate: toNum(data.completionRate),
      }
    : null

  return (
    <div id="reports-my-stats" className="space-y-6">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          data-export-exclude="true"
          onClick={() =>
            exportSectionToPdf('reports-my-stats', 'Reports - My Stats')
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Your personal contribution across all teams and retrospectives.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Teams"
          value={stats?.teamsCount ?? '—'}
          sub="Teams you are a member of"
        />
        <StatCard
          label="Retros Attended"
          value={stats?.retroCount ?? '—'}
          sub="Retros where you added at least one card"
        />
        <StatCard
          label="Cards Created"
          value={stats?.cardsCreated ?? '—'}
          sub="Total cards you've contributed across all retros"
        />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Action Items</CardDescription>
            <CardTitle className="text-3xl">
              {stats?.actionItemsAssigned ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {stats?.actionItemsCompleted ?? 0} completed of{' '}
              {stats?.actionItemsAssigned ?? 0} assigned
            </p>
            {stats && stats.actionItemsAssigned > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    barColor(
                      stats.actionItemsCompleted,
                      stats.actionItemsAssigned,
                    ),
                  )}
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab({ teams }: { teams: Team[] }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    teams[0]?.id ?? '',
  )
  const [period, setPeriod] = useState<Period>('month')
  const [filterUserId, setFilterUserId] = useState<string>('')

  const activeTeamId = selectedTeamId || teams[0]?.id || ''

  // Fetch team members for the user filter
  const { data: teamDetail } = useQuery({
    queryKey: ['team-detail-for-reports', activeTeamId],
    queryFn: () =>
      api.get<{
        members: Array<{ userId: string; user: { name: string | null } }>
      }>(TEAMS_ENDPOINTS.BY_ID(activeTeamId)),
    enabled: !!activeTeamId,
  })
  const teamMembers = teamDetail?.members ?? []

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['team-metrics', activeTeamId, period, filterUserId],
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (filterUserId) params.set('userId', filterUserId)
      return api.get<TeamMetrics>(
        `${REPORTS_ENDPOINTS.TEAM_METRICS(activeTeamId)}?${params.toString()}`,
      )
    },
    enabled: !!activeTeamId,
  })

  const { data: healthScore, isLoading: healthLoading } = useQuery({
    queryKey: ['health-score', activeTeamId, period],
    queryFn: () =>
      api.get<HealthScore>(
        `${REPORTS_ENDPOINTS.TEAM_HEALTH(activeTeamId)}?period=${period}`,
      ),
    enabled: !!activeTeamId,
  })

  const { data: actionItems, isLoading: actionsLoading } = useQuery({
    queryKey: ['action-analytics', activeTeamId, period],
    queryFn: () =>
      api.get<ActionItemAnalytics>(
        `${REPORTS_ENDPOINTS.TEAM_ACTION_ITEMS(activeTeamId)}?period=${period}`,
      ),
    enabled: !!activeTeamId,
  })

  const { data: estimateKPIs, isLoading: estimatesLoading } = useQuery({
    queryKey: ['estimate-kpis', activeTeamId, period],
    queryFn: () =>
      api.get<EstimateKPIs>(
        `${REPORTS_ENDPOINTS.TEAM_ESTIMATE_KPIS(activeTeamId)}?period=${period}`,
      ),
    enabled: !!activeTeamId,
  })

  if (teams.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            No teams available.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isLoading =
    metricsLoading || healthLoading || actionsLoading || estimatesLoading

  const chartPalette = {
    tooltipBg: 'var(--popover)',
    tooltipBorder: 'var(--border)',
    tooltipText: 'var(--popover-foreground)',
    actionCompleted: '#10b981',
    actionPending: '#0ea5e9',
    actionOverdue: '#f43f5e',
  }

  const TrendIcon =
    healthScore?.trend === 'increasing'
      ? TrendingUp
      : healthScore?.trend === 'decreasing'
        ? TrendingDown
        : Minus

  const trendColor =
    healthScore?.trend === 'increasing'
      ? 'text-green-500'
      : healthScore?.trend === 'decreasing'
        ? 'text-red-500'
        : 'text-muted-foreground'

  const m = metrics
    ? {
        retroCount: toNum(metrics.retroCount),
        avgParticipants: toNum(metrics.avgParticipants),
        participationRate: toNum(metrics.participationRate),
        totalCards: toNum(metrics.totalCards),
        totalVotes: toNum(metrics.totalVotes),
        avgCardsPerRetro: toNum(metrics.avgCardsPerRetro),
        actionItemsCompleted: toNum(metrics.actionItemsCompleted),
        actionItemsPending: toNum(metrics.actionItemsPending),
      }
    : null

  const hs = healthScore
    ? {
        score: toNum(healthScore.score),
        participationPoints: toNum(healthScore.participationPoints),
        engagementPoints: toNum(healthScore.engagementPoints),
        completionPoints: healthScore.completionPoints,
        frequencyPoints: toNum(healthScore.frequencyPoints),
        description: healthScore.description,
        trend: healthScore.trend,
      }
    : null

  const ai = actionItems
    ? {
        completed: toNum(actionItems.completed),
        pending: toNum(actionItems.pending),
        overdue: toNum(actionItems.overdue),
        completionRate: toNum(actionItems.completionRate),
        topAssignees: actionItems.topAssignees,
      }
    : null

  const actionPieData = ai
    ? [
        {
          name: 'Completed',
          value: ai.completed,
          color: chartPalette.actionCompleted,
        },
        {
          name: 'Pending',
          value: ai.pending - ai.overdue,
          color: chartPalette.actionPending,
        },
        {
          name: 'Overdue',
          value: ai.overdue,
          color: chartPalette.actionOverdue,
        },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div id="reports-teams" className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={activeTeamId} onValueChange={setSelectedTeamId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.emoji} {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>

        {teamMembers.length > 0 && (
          <Select
            value={filterUserId || '__all__'}
            onValueChange={(v) => setFilterUserId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Members</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.user.name ?? member.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline"
          size="sm"
          data-export-exclude="true"
          onClick={() => exportSectionToPdf('reports-teams', 'Reports - Teams')}
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <TeamsTabSkeleton />
      ) : (
        <>
          {/* Health Score */}
          {hs && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Team Health Score
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <TrendIcon className={cn('h-4 w-4', trendColor)} />
                    <Badge
                      variant={
                        hs.score >= 80
                          ? 'default'
                          : hs.score >= 60
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {hs.score}/100
                    </Badge>
                  </div>
                </div>
                <CardDescription>{hs.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Each dimension scores <strong>points</strong> toward the
                  100-point total. A higher maximum means that dimension has
                  more impact on your overall score.
                </p>
                <ColorBar
                  label="Participation"
                  description="% of team members who added cards"
                  value={hs.participationPoints}
                  max={30}
                />
                <ColorBar
                  label="Engagement"
                  description="Cards per session and votes per card"
                  value={hs.engagementPoints}
                  max={25}
                />
                {hs.completionPoints !== null ? (
                  <ColorBar
                    label="Completion"
                    description="Retro action items marked as done"
                    value={hs.completionPoints}
                    max={25}
                  />
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">Completion</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          Retro action items marked as done
                        </span>
                      </div>
                      <span className="shrink-0 text-right text-sm text-muted-foreground">
                        N/A — no action items in this period
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" />
                  </div>
                )}
                <ColorBar
                  label="Frequency"
                  description="How often retros are held (target: 2/month)"
                  value={hs.frequencyPoints}
                  max={20}
                />
              </CardContent>
            </Card>
          )}

          {/* Activity Stats */}
          {m && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Retrospectives"
                value={m.retroCount}
                sub={`Avg ${m.avgParticipants} contributors per retro`}
              />
              <StatCard
                label="Participation Rate"
                value={`${m.participationRate}%`}
                sub="Team members who contributed cards"
              />
              <StatCard
                label="Cards Created"
                value={m.totalCards}
                sub={`Avg ${m.avgCardsPerRetro} per retro · ${m.totalVotes} votes cast`}
              />
              <StatCard
                label="Action Items"
                value={m.actionItemsCompleted + m.actionItemsPending}
                sub={`${m.actionItemsCompleted} completed · ${m.actionItemsPending} pending`}
              />
            </div>
          )}

          {/* Action Items Breakdown + Top Assignees */}
          <div className="grid gap-4 md:grid-cols-2">
            {actionPieData.length > 0 && ai && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    Action Items Breakdown
                  </CardTitle>
                  <CardDescription>
                    {ai.completionRate}% completion rate — tracks follow-through
                    on items assigned during retros
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense
                    fallback={
                      <div className="flex h-55 items-center justify-center text-sm text-muted-foreground">
                        Loading chart...
                      </div>
                    }
                  >
                    <ActionItemsPieChart
                      data={actionPieData}
                      palette={{
                        tooltipBg: chartPalette.tooltipBg,
                        tooltipBorder: chartPalette.tooltipBorder,
                        tooltipText: chartPalette.tooltipText,
                      }}
                    />
                  </Suspense>
                </CardContent>
              </Card>
            )}

            {ai && ai.topAssignees.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Assignees</CardTitle>
                  <CardDescription>
                    Team members with the most action items
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ai.topAssignees.map((assignee) => (
                      <div
                        key={assignee.userId}
                        className="flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {assignee.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignee.completedCount}/{assignee.assignedCount}{' '}
                            completed
                          </p>
                        </div>
                        <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              barColor(
                                assignee.completedCount,
                                assignee.assignedCount,
                              ),
                            )}
                            style={{
                              width:
                                assignee.assignedCount > 0
                                  ? `${Math.round((assignee.completedCount / assignee.assignedCount) * 100)}%`
                                  : '0%',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Story Estimation KPIs */}
          {estimateKPIs && estimateKPIs.sessionsCompleted > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Story Estimation
                </CardTitle>
                <CardDescription>
                  How the team estimates stories — sessions, stories estimated,
                  and voter participation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Sessions Completed
                    </p>
                    <p className="text-2xl font-semibold">
                      {estimateKPIs.sessionsCompleted}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Stories Estimated
                    </p>
                    <p className="text-2xl font-semibold">
                      {estimateKPIs.storiesEstimated}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Voter Participation
                    </p>
                    <p className="text-2xl font-semibold">
                      {estimateKPIs.participationRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg Votes / Story
                    </p>
                    <p className="text-2xl font-semibold">
                      {estimateKPIs.avgVotesPerStory}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Team Breakdown Table (server-side pagination) ───────────────────────────

const BREAKDOWN_PAGE_SIZES = [8, 16, 32]

// ─── Organization Tab ─────────────────────────────────────────────────────────

function OrgTab({ orgs }: { orgs: Organization[] }) {
  const queryClient = useQueryClient()
  const [selectedOrgId, setSelectedOrgId] = useState<string>(orgs[0]?.id ?? '')
  const [period, setPeriod] = useState<Period>('month')
  const [tbPage, setTbPage] = useState(1)
  const [tbPageSize, setTbPageSize] = useState(8)
  const [tbSearch, setTbSearch] = useState('')

  const activeOrgId = selectedOrgId || orgs[0]?.id || ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'org-overview',
      activeOrgId,
      period,
      tbPage,
      tbPageSize,
      tbSearch,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        period,
        tbPage: String(tbPage),
        tbLimit: String(tbPageSize),
      })
      const normalizedSearch = tbSearch.trim()
      if (normalizedSearch) {
        params.set('tbSearch', normalizedSearch)
      }
      return api.get<OrgOverview>(
        `${REPORTS_ENDPOINTS.ORG_OVERVIEW(activeOrgId)}?${params.toString()}`,
      )
    },
    enabled: !!activeOrgId,
    placeholderData: keepPreviousData,
  })

  const tbTotal = data?.teamBreakdownTotal ?? 0
  const tbTotalPages = data?.teamBreakdownTotalPages ?? 1

  const handleRefreshBreakdown = () =>
    queryClient.invalidateQueries({
      queryKey: ['org-overview', activeOrgId, period],
    })

  const handleExportOrgPdf = async () => {
    if (!activeOrgId) return

    const fullData = await api.get<OrgOverview>(
      `${REPORTS_ENDPOINTS.ORG_OVERVIEW(activeOrgId)}?period=${period}&tbPage=1&tbLimit=5000`,
    )

    const tableRows = fullData.teamBreakdown
      .map(
        (team) => `
          <tr>
            <td>${escapeHtml(team.teamName)}</td>
            <td>${team.retroCount}</td>
            <td>${team.memberCount}</td>
            <td>${team.participationRate}%</td>
          </tr>
        `,
      )
      .join('')

    const contentHtml = `
      <div class="space-y-4">
        <div class="export-card-grid">
          <div class="export-card">
            <div class="export-card-label">Teams</div>
            <div class="export-card-value">${fullData.teamsCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Members</div>
            <div class="export-card-value">${fullData.membersCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Retrospectives</div>
            <div class="export-card-value">${fullData.retroCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Avg Participation</div>
            <div class="export-card-value">${fullData.participationRate}%</div>
          </div>
        </div>
        <h2 style="font-size:16px; margin: 12px 0 8px;">Team Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Retros</th>
              <th>Members</th>
              <th>Participation</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="4">No teams found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `

    openPrintWindow('Reports - Organization', contentHtml)
  }

  return (
    <div id="reports-organization" className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {orgs.length > 1 && (
          <Select
            value={activeOrgId}
            onValueChange={(v) => {
              setSelectedOrgId(v)
              setTbPage(1)
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={period}
          onValueChange={(v) => {
            setPeriod(v as Period)
            setTbPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          data-export-exclude="true"
          onClick={() => void handleExportOrgPdf()}
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <OrgTabSkeleton />
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Teams"
              value={toNum(data.teamsCount)}
              sub="Teams in this organization"
            />
            <StatCard
              label="Members"
              value={toNum(data.membersCount)}
              sub="Unique members across all teams"
            />
            <StatCard
              label="Retrospectives"
              value={toNum(data.retroCount)}
              sub={`${toNum(data.totalCards)} cards · ${toNum(data.totalVotes)} votes`}
            />
            <StatCard
              label="Avg Participation"
              value={`${toNum(data.participationRate)}%`}
              sub={`${toNum(data.actionItemsCompleted)} action items done · ${toNum(data.actionItemsPending)} pending`}
            />
          </div>

          {tbTotal > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Team Breakdown
                  </CardTitle>
                  <div className="relative min-w-55">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={tbSearch}
                      onChange={(event) => {
                        setTbSearch(event.target.value)
                        setTbPage(1)
                      }}
                      placeholder="Search teams"
                      className="pl-9"
                    />
                  </div>
                </div>
                <CardDescription>
                  Participation per team in the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Team</th>
                        <th className="pb-2 pr-4 font-medium">Retros</th>
                        <th className="pb-2 pr-4 font-medium">Members</th>
                        <th className="pb-2 font-medium">Participation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teamBreakdown.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-muted-foreground"
                          >
                            No teams found.
                          </td>
                        </tr>
                      ) : (
                        data.teamBreakdown.map((team) => (
                          <tr
                            key={team.teamId}
                            className="border-b last:border-0"
                          >
                            <td className="py-2 pr-4 font-medium">
                              {team.teamName}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {team.retroCount}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {team.memberCount}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      barColor(team.participationRate, 100),
                                    )}
                                    style={{
                                      width: `${team.participationRate}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-muted-foreground">
                                  {team.participationRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page</span>
                    <Select
                      value={String(tbPageSize)}
                      onValueChange={(val) => {
                        setTbPageSize(Number(val))
                        setTbPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BREAKDOWN_PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>
                      Page {tbPage} of {tbTotalPages} &middot; {tbTotal} team
                      {tbTotal === 1 ? '' : 's'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1"
                      onClick={handleRefreshBreakdown}
                      disabled={isFetching}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTbPage((p) => p - 1)}
                      disabled={tbPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTbPage((p) => p + 1)}
                      disabled={tbPage >= tbTotalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab() {
  const queryClient = useQueryClient()
  const [obPage, setObPage] = useState(1)
  const [obPageSize, setObPageSize] = useState(8)
  const [obSearch, setObSearch] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['system-overview', obPage, obPageSize, obSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        obPage: String(obPage),
        obLimit: String(obPageSize),
      })
      const normalizedSearch = obSearch.trim()
      if (normalizedSearch) {
        params.set('obSearch', normalizedSearch)
      }
      return api.get<SystemOverview>(
        `${REPORTS_ENDPOINTS.SYSTEM}?${params.toString()}`,
      )
    },
    placeholderData: keepPreviousData,
  })

  const obTotal = data?.orgBreakdownTotal ?? 0
  const obTotalPages = data?.orgBreakdownTotalPages ?? 1

  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ['system-overview'] })

  const handleExportSystemPdf = async () => {
    const fullData = await api.get<SystemOverview>(
      `${REPORTS_ENDPOINTS.SYSTEM}?obPage=1&obLimit=5000`,
    )

    const tableRows = fullData.orgBreakdown
      .map(
        (org) => `
          <tr>
            <td>${escapeHtml(org.orgName)}</td>
            <td>${org.teamsCount}</td>
            <td>${org.membersCount}</td>
            <td>${org.retroCount}</td>
          </tr>
        `,
      )
      .join('')

    const contentHtml = `
      <div class="space-y-4">
        <div class="export-card-grid">
          <div class="export-card">
            <div class="export-card-label">Organizations</div>
            <div class="export-card-value">${fullData.orgsCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Teams</div>
            <div class="export-card-value">${fullData.teamsCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Users</div>
            <div class="export-card-value">${fullData.usersCount}</div>
          </div>
          <div class="export-card">
            <div class="export-card-label">Retros (30d)</div>
            <div class="export-card-value">${fullData.retroCount}</div>
          </div>
        </div>
        <h2 style="font-size:16px; margin: 12px 0 8px;">Organization Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Teams</th>
              <th>Members</th>
              <th>Retros (30d)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="4">No organizations found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `

    openPrintWindow('Reports - System', contentHtml)
  }

  return (
    <div id="reports-system" className="space-y-6">
      <p className="text-sm text-muted-foreground">
        System-wide statistics across all organizations (last 30 days for
        activity data).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          data-export-exclude="true"
          onClick={() => void handleExportSystemPdf()}
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <SystemTabSkeleton />
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Organizations"
              value={toNum(data.orgsCount)}
              sub="Total organizations in the system"
            />
            <StatCard
              label="Teams"
              value={toNum(data.teamsCount)}
              sub="Total teams across all organizations"
            />
            <StatCard
              label="Users"
              value={toNum(data.usersCount)}
              sub="Approved users in the system"
            />
            <StatCard
              label="Retros (30d)"
              value={toNum(data.retroCount)}
              sub={`${toNum(data.totalCards)} cards created in the last 30 days`}
            />
          </div>

          {obTotal > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4" />
                    Organization Breakdown
                  </CardTitle>
                  <div className="relative min-w-55">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={obSearch}
                      onChange={(event) => {
                        setObSearch(event.target.value)
                        setObPage(1)
                      }}
                      placeholder="Search organizations"
                      className="pl-9"
                    />
                  </div>
                </div>
                <CardDescription>
                  Activity per organization in the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Organization</th>
                        <th className="pb-2 pr-4 font-medium">Teams</th>
                        <th className="pb-2 pr-4 font-medium">Members</th>
                        <th className="pb-2 font-medium">Retros (30d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orgBreakdown.map((org) => (
                        <tr key={org.orgId} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">
                            {org.orgName}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {org.teamsCount}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {org.membersCount}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {org.retroCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page</span>
                    <Select
                      value={String(obPageSize)}
                      onValueChange={(val) => {
                        setObPageSize(Number(val))
                        setObPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BREAKDOWN_PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>
                      Page {obPage} of {obTotalPages} &middot; {obTotal} org
                      {obTotal === 1 ? '' : 's'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1"
                      onClick={handleRefresh}
                      disabled={isFetching}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setObPage((p) => p - 1)}
                      disabled={obPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setObPage((p) => p + 1)}
                      disabled={obPage >= obTotalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
