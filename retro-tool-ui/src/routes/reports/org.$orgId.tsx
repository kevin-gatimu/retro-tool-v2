import { lazy, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  Download,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHART_COLORS } from './components/charts/chart-defaults'
import { CadenceHeatGrid } from './components/charts/cadence-heat-grid'
import { ChartCard } from './components/chart-card'
import { EmptyReportState } from './components/empty-report-state'
import { LeagueTable } from './components/league-table'
import { ReportLoadError } from './components/report-load-error'
import { ReportPageHeader } from './components/report-page-header'
import { ReportScopePicker } from './components/report-scope-picker'
import { ReportSwitcher } from './components/report-switcher'
import { StatCard } from './components/stat-card'
import { reportSearchSchema } from './hooks/use-report-range'
import { useReportAccess } from './hooks/use-report-access'
import {
  orgReportQueryOptions,
  useOrgTeamsLeague,
} from './hooks/use-report-queries'
import { downloadCsv } from './helpers/download-csv'
import { exportReportPdf } from './helpers/export-report-pdf'
import { ReportsSkeleton } from './skeleton'
import type { OrgReport, OrgTeamLeagueRow } from './types'

const TrendAreaChart = lazy(
  () => import('./components/charts/trend-area-chart'),
)
const DonutChart = lazy(() => import('./components/charts/donut-chart'))

export const Route = createFileRoute('/reports/org/$orgId')({
  validateSearch: (search) => reportSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context: { queryClient }, params, deps }) =>
    queryClient.ensureQueryData(
      orgReportQueryOptions(params.orgId, deps.period),
    ),
  pendingComponent: () => <ReportsSkeleton variant="org" />,
  errorComponent: ({ error }) => (
    <ReportLoadError error={error} reportName="organization report" />
  ),
  component: OrgReportPage,
})

function exportPdf(report: OrgReport) {
  void exportReportPdf(
    `${report.orgName} organization report`,
    `${report.range.from.slice(0, 10)} → ${report.range.to.slice(0, 10)}`,
    [
      {
        heading: 'Key metrics',
        rows: [
          ['Members', report.kpis.members],
          ['Teams', report.kpis.teams],
          ['Retros in range', report.kpis.retrosInRange],
          ['Active teams', report.kpis.activeTeamsInRange],
        ],
      },
      {
        heading: 'Template usage',
        table: {
          headers: ['Template', 'Retros'],
          rows: report.templateUsage.map((slice) => [
            slice.template,
            slice.count,
          ]),
        },
      },
      {
        heading: 'Teams at risk (no retro in 30 days)',
        table: {
          headers: ['Team', 'Days since last retro'],
          rows: report.atRiskTeams.map((team) => [
            team.name,
            team.daysSinceLastRetro ?? 'never',
          ]),
        },
      },
    ],
  )
}

function OrgReportPage() {
  const { orgId } = Route.useParams()
  const { period } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: report } = useSuspenseQuery(
    orgReportQueryOptions(orgId, period),
  )
  const { adminOrgs } = useReportAccess()

  const [teamPage, setTeamPage] = useState(1)
  const [teamSearch, setTeamSearch] = useState('')
  const teamsLeague = useOrgTeamsLeague(orgId, period, {
    page: teamPage,
    pageSize: 20,
    search: teamSearch,
  })

  return (
    <div className="space-y-6">
      <ReportPageHeader
        title={`${report.orgName} — Organization`}
        description="Cross-team activity, growth, and delivery health"
        period={period}
        onPeriodChange={(value) =>
          navigate({ search: { period: value }, replace: true })
        }
        switcher={
          <>
            <ReportSwitcher current="org" period={period} />
            <ReportScopePicker
              scope="org"
              options={adminOrgs.map((org) => ({ id: org.id, name: org.name }))}
              currentId={orgId}
              period={period}
              placeholder="Select organization…"
            />
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => exportPdf(report)}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Members" value={report.kpis.members} icon={Users} />
        <StatCard title="Teams" value={report.kpis.teams} icon={Building2} />
        <StatCard
          title="Retros in range"
          value={report.kpis.retrosInRange}
          icon={CalendarCheck}
        />
        <StatCard
          title="Active teams"
          value={report.kpis.activeTeamsInRange}
          hint="Teams that completed a retro in range"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Growth"
          description="New members and teams per period"
        >
          <TrendAreaChart
            data={report.growth}
            series={[
              { key: 'members', label: 'New members', color: CHART_COLORS[0] },
              { key: 'teams', label: 'New teams', color: CHART_COLORS[1] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Template usage"
          description="Retro templates used across the range"
        >
          {report.templateUsage.length > 0 ? (
            <DonutChart
              data={report.templateUsage.map((slice) => ({
                name: slice.template,
                value: slice.count,
              }))}
            />
          ) : (
            <EmptyReportState message="No completed retros in this range." />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Retro cadence"
        description="Completed retros per team per period"
      >
        <CadenceHeatGrid cells={report.cadenceHeat} />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team league</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paginated and searchable — computed in SQL
          </p>
        </CardHeader>
        <CardContent>
          <LeagueTable<OrgTeamLeagueRow>
            rows={teamsLeague.data?.rows ?? []}
            rowKey={(row) => row.teamId}
            emptyMessage="No teams match."
            isFetching={teamsLeague.isFetching}
            search={{
              value: teamSearch,
              onChange: (value) => {
                setTeamSearch(value)
                setTeamPage(1)
              },
              placeholder: 'Search teams…',
            }}
            pagination={{
              page: teamsLeague.data?.page ?? teamPage,
              pageSize: teamsLeague.data?.pageSize ?? 20,
              total: teamsLeague.data?.total ?? 0,
              onPageChange: setTeamPage,
            }}
            onExportCsv={() =>
              downloadCsv(
                `${report.orgName}-teams.csv`,
                ['Team', 'Members', 'Retros', 'Attendance %'],
                (teamsLeague.data?.rows ?? []).map((row) => [
                  row.name,
                  row.members,
                  row.retrosInRange,
                  row.attendanceRate,
                ]),
              )
            }
            columns={[
              {
                header: 'Team',
                render: (row) => (
                  <Link
                    to="/reports/team/$teamId"
                    params={{ teamId: row.teamId }}
                    search={{ period }}
                    className="font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                ),
                csv: (row) => row.name,
              },
              {
                header: 'Members',
                align: 'right',
                render: (row) => row.members,
                csv: (row) => row.members,
              },
              {
                header: 'Retros',
                align: 'right',
                render: (row) => row.retrosInRange,
                csv: (row) => row.retrosInRange,
              },
              {
                header: 'Attendance',
                align: 'right',
                render: (row) => `${row.attendanceRate}%`,
                csv: (row) => row.attendanceRate,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Teams at risk
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            No completed retro in the last 30 days
          </p>
        </CardHeader>
        <CardContent>
          {report.atRiskTeams.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Every team has run a retro recently.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.atRiskTeams.map((team) => (
                <Badge key={team.teamId} variant="secondary">
                  {team.name}
                  {team.daysSinceLastRetro !== null
                    ? ` — ${team.daysSinceLastRetro}d`
                    : ' — never'}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
