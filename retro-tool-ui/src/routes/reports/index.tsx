import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useReportAccess } from './hooks/use-report-access'
import { ReportsSkeleton } from './skeleton'

export const Route = createFileRoute('/reports/')({
  component: ReportsIndex,
})

/**
 * `/reports` lands every role on its best dashboard:
 * system admins → system, org admins → their org, everyone else → My Insights.
 * Shares {@link useReportAccess} with the in-page switcher so both agree.
 */
function ReportsIndex() {
  const { isPending, canSystem, defaultOrgId } = useReportAccess()

  if (isPending) return <ReportsSkeleton />

  if (canSystem) {
    return (
      <Navigate to="/reports/system" search={{ period: 'quarter' }} replace />
    )
  }

  if (defaultOrgId) {
    return (
      <Navigate
        to="/reports/org/$orgId"
        params={{ orgId: defaultOrgId }}
        search={{ period: 'quarter' }}
        replace
      />
    )
  }

  return <Navigate to="/reports/me" search={{ period: 'quarter' }} replace />
}
