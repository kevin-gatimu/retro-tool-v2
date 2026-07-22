import { lazy, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Activity, Building2, Download, UserCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHART_COLORS } from './components/charts/chart-defaults'
import { ChartCard } from './components/chart-card'
import { EmptyReportState } from './components/empty-report-state'
import { LeagueTable } from './components/league-table'
import { ReportLoadError } from './components/report-load-error'
import { ReportPageHeader } from './components/report-page-header'
import { ReportSwitcher } from './components/report-switcher'
import { StatCard } from './components/stat-card'
import { reportSearchSchema } from './hooks/use-report-range'
import {
  platformReportQueryOptions,
  usePlatformOrgsLeague,
} from './hooks/use-report-queries'
import { downloadCsv } from './helpers/download-csv'
import { exportReportPdf } from './helpers/export-report-pdf'
import { ReportsSkeleton } from './skeleton'
import type { OrgLeagueRow, PlatformReport } from './types'

const TrendAreaChart = lazy(
  () => import('./components/charts/trend-area-chart'),
)
const DonutChart = lazy(() => import('./components/charts/donut-chart'))

export const Route = createFileRoute('/reports/system')({
  validateSearch: (search) => reportSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(platformReportQueryOptions(deps.period)),
  pendingComponent: () => <ReportsSkeleton variant="system" />,
  errorComponent: ({ error }) => (
    <ReportLoadError error={error} reportName="system report" />
  ),
  component: PlatformReportPage,
})

function exportPdf(report: PlatformReport) {
  void exportReportPdf(
    'Platform report',
    `${report.range.from.slice(0, 10)} → ${report.range.to.slice(0, 10)}`,
    [
      {
        heading: 'Key metrics',
        rows: [
          ['Total users', report.kpis.totalUsers],
          ['Pending approval', report.kpis.pendingUsers],
          ['Active users (7d)', report.kpis.activeUsers7d],
          ['Active users (30d)', report.kpis.activeUsers30d],
          ['Organizations', report.kpis.organizations],
          ['Teams', report.kpis.teams],
        ],
      },
      {
        heading: 'User status funnel',
        table: {
          headers: ['Status', 'Users'],
          rows: report.statusFunnel.map((slice) => [slice.status, slice.count]),
        },
      },
    ],
  )
}

function PlatformReportPage() {
  const { period } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: report } = useSuspenseQuery(platformReportQueryOptions(period))

  const [orgPage, setOrgPage] = useState(1)
  const [orgSearch, setOrgSearch] = useState('')
  const orgsLeague = usePlatformOrgsLeague(period, {
    page: orgPage,
    pageSize: 20,
    search: orgSearch,
  })

  return (
    <div className="space-y-6">
      <ReportPageHeader
        title="System"
        description="Growth, active usage, and feature adoption across the whole system"
        period={period}
        onPeriodChange={(value) =>
          navigate({ search: { period: value }, replace: true })
        }
        switcher={<ReportSwitcher current="system" period={period} />}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportPdf(report)}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="Users" value={report.kpis.totalUsers} icon={Users} />
        <StatCard
          title="Pending approval"
          value={report.kpis.pendingUsers}
          icon={UserCheck}
        />
        <StatCard
          title="Active (7d)"
          value={report.kpis.activeUsers7d}
          icon={Activity}
        />
        <StatCard title="Active (30d)" value={report.kpis.activeUsers30d} />
        <StatCard
          title="Organizations"
          value={report.kpis.organizations}
          icon={Building2}
        />
        <StatCard title="Teams" value={report.kpis.teams} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="User growth" description="Sign-ups per period">
          <TrendAreaChart
            data={report.userGrowth}
            series={[
              { key: 'signups', label: 'Sign-ups', color: CHART_COLORS[0] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="User status funnel"
          description="Current status of every account"
        >
          {report.statusFunnel.length > 0 ? (
            <DonutChart
              data={report.statusFunnel.map((slice) => ({
                name: slice.status,
                value: slice.count,
              }))}
            />
          ) : (
            <EmptyReportState message="No users yet." />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Feature adoption"
        description="Activity volume per feature across the range"
      >
        <TrendAreaChart
          data={report.activity}
          stacked
          height={320}
          series={[
            { key: 'retros', label: 'Retros', color: CHART_COLORS[0] },
            {
              key: 'storyEstimateSessions',
              label: 'Story estimates',
              color: CHART_COLORS[1],
            },
            { key: 'standups', label: 'Standups', color: CHART_COLORS[2] },
            { key: 'surveys', label: 'Surveys', color: CHART_COLORS[3] },
            { key: 'polls', label: 'Polls', color: CHART_COLORS[4] },
            {
              key: 'icebreakerSessions',
              label: 'Icebreakers',
              color: 'var(--muted-foreground)',
            },
          ]}
        />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization league</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paginated and searchable — computed in SQL
          </p>
        </CardHeader>
        <CardContent>
          <LeagueTable<OrgLeagueRow>
            rows={orgsLeague.data?.rows ?? []}
            rowKey={(row) => row.orgId}
            emptyMessage="No organizations match."
            isFetching={orgsLeague.isFetching}
            search={{
              value: orgSearch,
              onChange: (value) => {
                setOrgSearch(value)
                setOrgPage(1)
              },
              placeholder: 'Search organizations…',
            }}
            pagination={{
              page: orgsLeague.data?.page ?? orgPage,
              pageSize: orgsLeague.data?.pageSize ?? 20,
              total: orgsLeague.data?.total ?? 0,
              onPageChange: setOrgPage,
            }}
            onExportCsv={() =>
              downloadCsv(
                'platform-organizations.csv',
                ['Organization', 'Members', 'Teams', 'Retros'],
                (orgsLeague.data?.rows ?? []).map((row) => [
                  row.name,
                  row.members,
                  row.teams,
                  row.retrosInRange,
                ]),
              )
            }
            columns={[
              {
                header: 'Organization',
                render: (row) => row.name,
                csv: (row) => row.name,
              },
              {
                header: 'Members',
                align: 'right',
                render: (row) => row.members,
                csv: (row) => row.members,
              },
              {
                header: 'Teams',
                align: 'right',
                render: (row) => row.teams,
                csv: (row) => row.teams,
              },
              {
                header: 'Retros',
                align: 'right',
                render: (row) => row.retrosInRange,
                csv: (row) => row.retrosInRange,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
