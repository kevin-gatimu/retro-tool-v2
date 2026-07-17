import { lazy, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { CalendarCheck, Download, MessageSquare, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CHART_COLORS } from './components/charts/chart-defaults'
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
  teamReportQueryOptions,
  useTeamMembersLeague,
} from './hooks/use-report-queries'
import { downloadCsv } from './helpers/download-csv'
import { exportReportPdf } from './helpers/export-report-pdf'
import { ReportsSkeleton } from './skeleton'
import type { TeamMemberBreakdownRow, TeamReport } from './types'

const TrendAreaChart = lazy(
  () => import('./components/charts/trend-area-chart'),
)
const StackedBarChart = lazy(
  () => import('./components/charts/stacked-bar-chart'),
)
const HealthGauge = lazy(() => import('./components/charts/health-gauge'))

export const Route = createFileRoute('/reports/team/$teamId')({
  validateSearch: (search) => reportSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context: { queryClient }, params, deps }) =>
    queryClient.ensureQueryData(
      teamReportQueryOptions(params.teamId, deps.period),
    ),
  pendingComponent: () => <ReportsSkeleton variant="team" />,
  errorComponent: ({ error }) => (
    <ReportLoadError error={error} reportName="team report" />
  ),
  component: TeamHealthPage,
})

function exportPdf(report: TeamReport) {
  void exportReportPdf(
    `${report.teamName} team health`,
    `${report.range.from.slice(0, 10)} → ${report.range.to.slice(0, 10)}`,
    [
      {
        heading: 'Key metrics',
        rows: [
          ['Health score', `${report.health.score}/100`],
          ['Retros completed', report.kpis.retrosCompleted],
          ['Attendance', `${report.kpis.attendanceRate}%`],
          ['Cards per retro', report.kpis.cardsPerRetro],
          ['Discussion coverage', `${report.kpis.discussionCoverage}%`],
          ['Estimate consensus', `${report.kpis.consensusRate}%`],
          ['Avg vote spread', report.voteSpreadAvg],
        ],
      },
      {
        heading: 'Sentiment mix (cards per column)',
        table: {
          headers: ['Column', 'Cards'],
          rows: report.sentiment.map((slice) => [slice.column, slice.cards]),
        },
      },
    ],
  )
}

function TeamHealthPage() {
  const { teamId } = Route.useParams()
  const { period } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: report } = useSuspenseQuery(
    teamReportQueryOptions(teamId, period),
  )
  const { myTeams } = useReportAccess()

  const [memberPage, setMemberPage] = useState(1)
  const [memberSearch, setMemberSearch] = useState('')
  const membersLeague = useTeamMembersLeague(
    teamId,
    period,
    { page: memberPage, pageSize: 20, search: memberSearch },
    report.isLead,
  )

  const healthComponents = [
    {
      label: 'Participation (retro attendance)',
      value: report.health.components.participation,
    },
    {
      label: 'Engagement (retro cards)',
      value: report.health.components.engagement,
    },
    {
      label: 'Consensus (story estimates)',
      value: report.health.components.consensus,
    },
    {
      label: 'Frequency (retro cadence)',
      value: report.health.components.frequency,
    },
  ]

  return (
    <div className="space-y-6">
      <ReportPageHeader
        title={`${report.teamName} — Team health`}
        description={
          report.isLead
            ? 'Full team analytics including per-member breakdown'
            : 'Aggregate team analytics'
        }
        period={period}
        onPeriodChange={(value) =>
          navigate({ search: { period: value }, replace: true })
        }
        switcher={
          <>
            <ReportSwitcher current="team" period={period} />
            <ReportScopePicker
              scope="team"
              options={myTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              currentId={teamId}
              period={period}
              placeholder="Select team…"
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
        <StatCard
          title="Retros completed"
          value={report.kpis.retrosCompleted}
          icon={CalendarCheck}
        />
        <StatCard
          title="Attendance"
          value={`${report.kpis.attendanceRate}%`}
          hint="True attendance via participants"
        />
        <StatCard
          title="Discussion coverage"
          value={`${report.kpis.discussionCoverage}%`}
          hint={`${report.kpis.cardsPerRetro} cards per retro`}
          icon={MessageSquare}
        />
        <StatCard
          title="Estimate consensus"
          value={`${report.kpis.consensusRate}%`}
          hint={`Avg vote spread ${report.voteSpreadAvg}`}
          icon={Target}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Health score" description={report.health.description}>
          <HealthGauge
            score={report.health.score}
            description={report.health.description}
          />
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Health components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthComponents.map((component) => (
              <div key={component.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{component.label}</span>
                  <span className="text-muted-foreground">
                    {component.value}/100
                  </span>
                </div>
                <Progress value={component.value} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Attendance trend"
          description="Attendance rate per period (completed retros)"
        >
          <TrendAreaChart
            data={report.attendanceSeries}
            series={[
              {
                key: 'attendanceRate',
                label: 'Attendance %',
                color: CHART_COLORS[0],
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Sentiment mix"
          description="Cards per template column across the range"
        >
          {report.sentiment.length > 0 ? (
            <StackedBarChart
              data={report.sentiment.map((slice) => ({
                bucket: slice.column,
                cards: slice.cards,
              }))}
              layout="vertical"
              stacked={false}
              series={[
                { key: 'cards', label: 'Cards', color: CHART_COLORS[1] },
              ]}
            />
          ) : (
            <EmptyReportState message="No cards in this range." />
          )}
        </ChartCard>

        <ChartCard
          title="Vote concentration"
          description="How votes distribute across cards"
        >
          <StackedBarChart
            data={report.voteHistogram.map((bin) => ({
              bucket: `${bin.votes} votes`,
              cards: bin.cards,
            }))}
            stacked={false}
            series={[{ key: 'cards', label: 'Cards', color: CHART_COLORS[3] }]}
          />
        </ChartCard>

        <ChartCard
          title="Story estimate velocity"
          description="Rounds revealed and rounds reaching agreed points"
        >
          <TrendAreaChart
            data={report.estimateVelocity}
            series={[
              {
                key: 'roundsRevealed',
                label: 'Rounds revealed',
                color: CHART_COLORS[1],
              },
              {
                key: 'roundsAgreed',
                label: 'Rounds agreed',
                color: CHART_COLORS[0],
              },
            ]}
          />
        </ChartCard>

        {report.standupSeries.length > 0 ? (
          <ChartCard
            title="Standup submissions"
            description="Submission rate across the team's standups"
          >
            <TrendAreaChart
              data={report.standupSeries}
              series={[
                {
                  key: 'submissionRate',
                  label: 'Submission %',
                  color: CHART_COLORS[2],
                },
              ]}
            />
          </ChartCard>
        ) : null}
      </div>

      {report.isLead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">
              Visible to team leads and admins only
            </p>
          </CardHeader>
          <CardContent>
            <LeagueTable<TeamMemberBreakdownRow>
              rows={membersLeague.data?.rows ?? []}
              rowKey={(row) => row.userId}
              emptyMessage="No members match."
              isFetching={membersLeague.isFetching}
              search={{
                value: memberSearch,
                onChange: (value) => {
                  setMemberSearch(value)
                  setMemberPage(1)
                },
                placeholder: 'Search members…',
              }}
              pagination={{
                page: membersLeague.data?.page ?? memberPage,
                pageSize: membersLeague.data?.pageSize ?? 20,
                total: membersLeague.data?.total ?? 0,
                onPageChange: setMemberPage,
              }}
              onExportCsv={() =>
                downloadCsv(
                  `${report.teamName}-members.csv`,
                  ['Member', 'Retros attended', 'Cards', 'Votes'],
                  (membersLeague.data?.rows ?? []).map((row) => [
                    row.name,
                    row.retrosAttended,
                    row.cardsAuthored,
                    row.votesCast,
                  ]),
                )
              }
              columns={[
                {
                  header: 'Member',
                  render: (row) => row.name,
                  csv: (row) => row.name,
                },
                {
                  header: 'Retros attended',
                  align: 'right',
                  render: (row) => row.retrosAttended,
                  csv: (row) => row.retrosAttended,
                },
                {
                  header: 'Cards',
                  align: 'right',
                  render: (row) => row.cardsAuthored,
                  csv: (row) => row.cardsAuthored,
                },
                {
                  header: 'Votes',
                  align: 'right',
                  render: (row) => row.votesCast,
                  csv: (row) => row.votesCast,
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
