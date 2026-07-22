import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { CalendarCheck, CheckCircle2, Vote } from 'lucide-react'
import { CHART_COLORS } from './components/charts/chart-defaults'
import { ChartCard } from './components/chart-card'
import { ReportLoadError } from './components/report-load-error'
import { ReportPageHeader } from './components/report-page-header'
import { ReportSwitcher } from './components/report-switcher'
import { StatCard } from './components/stat-card'
import { reportSearchSchema } from './hooks/use-report-range'
import { personalReportQueryOptions } from './hooks/use-report-queries'
import { ReportsSkeleton } from './skeleton'

const TrendAreaChart = lazy(
  () => import('./components/charts/trend-area-chart'),
)
const StackedBarChart = lazy(
  () => import('./components/charts/stacked-bar-chart'),
)

export const Route = createFileRoute('/reports/me')({
  validateSearch: (search) => reportSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(personalReportQueryOptions(deps.period)),
  pendingComponent: () => <ReportsSkeleton variant="me" />,
  errorComponent: ({ error }) => (
    <ReportLoadError error={error} reportName="personal report" />
  ),
  component: MyInsightsPage,
})

function MyInsightsPage() {
  const { period } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: report } = useSuspenseQuery(personalReportQueryOptions(period))

  return (
    <div className="space-y-6">
      <ReportPageHeader
        title="My Insights"
        description="Your contributions, attendance, and story estimate participation"
        period={period}
        onPeriodChange={(value) =>
          navigate({ search: { period: value }, replace: true })
        }
        switcher={<ReportSwitcher current="me" period={period} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Retro attendance"
          value={`${report.attendance.rate}%`}
          hint={`${report.attendance.attended} of ${report.attendance.held} team retros`}
          icon={CalendarCheck}
        />
        <StatCard
          title="Story estimate participation"
          value={`${report.storyEstimates.participationRate}%`}
          hint={`${report.storyEstimates.roundsVoted} of ${report.storyEstimates.roundsHeld} rounds`}
          icon={Vote}
        />
        <StatCard
          title="Consensus agreement"
          value={`${report.storyEstimates.agreementRate}%`}
          hint="Votes matching the agreed points"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Retros contribution trend"
          description="Cards, votes, and comments you added per period"
        >
          <TrendAreaChart
            data={report.contributions}
            stacked
            series={[
              { key: 'cards', label: 'Cards', color: CHART_COLORS[0] },
              { key: 'votes', label: 'Votes', color: CHART_COLORS[1] },
              { key: 'comments', label: 'Comments', color: CHART_COLORS[2] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Retros attended vs held"
          description="True attendance from retro participation"
        >
          <StackedBarChart
            data={report.attendance.series}
            stacked={false}
            series={[
              { key: 'held', label: 'Held', color: CHART_COLORS[2] },
              { key: 'attended', label: 'Attended', color: CHART_COLORS[0] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Polls & surveys"
          description="Poll votes and survey responses you submitted per period"
        >
          <TrendAreaChart
            data={report.pollSurvey}
            stacked
            series={[
              { key: 'polls', label: 'Polls', color: CHART_COLORS[1] },
              { key: 'surveys', label: 'Surveys', color: CHART_COLORS[3] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Story estimates"
          description="Estimate votes you cast per period"
        >
          <TrendAreaChart
            data={report.estimateVotes}
            series={[{ key: 'votes', label: 'Votes', color: CHART_COLORS[4] }]}
          />
        </ChartCard>
      </div>
    </div>
  )
}
