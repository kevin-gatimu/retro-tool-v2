import { ApiError } from '@/lib/api'
import { EmptyReportState } from './empty-report-state'

interface ReportLoadErrorProps {
  error: unknown
  reportName: string
}

export function getReportLoadErrorMessage({
  error,
  reportName,
}: ReportLoadErrorProps): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has expired. Sign in again to view this report.'
    }

    if (error.status === 403) {
      return `You do not have permission to view the ${reportName}.`
    }

    if (error.status === 404) {
      return `The ${reportName} API is unavailable. Make sure the API and UI are running the same version.`
    }

    return `Could not load the ${reportName}: ${error.message}`
  }

  if (error instanceof Error) {
    return `Could not load the ${reportName}: ${error.message}`
  }

  return `Could not load the ${reportName}. Try refreshing the page.`
}

export function ReportLoadError(props: ReportLoadErrorProps) {
  return <EmptyReportState message={getReportLoadErrorMessage(props)} />
}
