import { toast } from 'sonner'
import { ReportMenu } from '@/components/report-menu'
import type { StandupEntryDetail } from '@/common/types/standups'
import { exportStandupPdf } from '../helpers/export-standup-pdf'
import { useSendStandupReport } from '../hooks/use-send-standup-report'

interface StandupReportMenuProps {
  entryDetail: StandupEntryDetail
  standupId: string
  date: string
}

export function StandupReportMenu({
  entryDetail,
  standupId,
  date,
}: StandupReportMenuProps) {
  const teamId = entryDetail.standup.team.id

  const sendReportMutation = useSendStandupReport(standupId)

  // PDF generation is async (it fetches the logo). Await it so any failure
  // surfaces as an error toast instead of silently doing nothing, and confirm
  // the download with the filename so the user knows where to find it. A null
  // result means the user cancelled the save dialog — stay quiet.
  const handleExportPdf = async () => {
    try {
      const filename = await exportStandupPdf(entryDetail)
      if (filename) {
        toast.success(`Report saved — ${filename}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to export the report',
      )
    }
  }

  return (
    <ReportMenu
      teamId={teamId}
      onExportPdf={handleExportPdf}
      onSendEmail={(recipients) =>
        sendReportMutation.mutate({ date, recipients })
      }
      isSending={sendReportMutation.isPending}
      dialogTitle="Email standup report"
      dialogDescription="Send this day's report to the whole team, or pick specific people."
    />
  )
}
