import { useNavigate } from '@tanstack/react-router'
import { Building2, ShieldCheck, User, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useReportAccess } from '../hooks/use-report-access'
import type { ReportType } from '../hooks/use-report-access'
import type { ReportPeriod } from '../types'

interface ReportSwitcherProps {
  current: ReportType
  period: ReportPeriod
}

const META: Record<ReportType, { label: string; icon: LucideIcon }> = {
  me: { label: 'My Insights', icon: User },
  team: { label: 'Team', icon: Users },
  org: { label: 'Organization', icon: Building2 },
  system: { label: 'System', icon: ShieldCheck },
}

/**
 * Role-gated navigation between report dashboards. Only shows the report types
 * the user can access (via {@link useReportAccess}); selecting one navigates,
 * carrying the current `period` and the resolved default team/org id.
 */
export function ReportSwitcher({ current, period }: ReportSwitcherProps) {
  const navigate = useNavigate()
  const { options, defaultTeamId, defaultOrgId } = useReportAccess()

  // Nothing to switch to (e.g. a plain member with no team) — hide entirely.
  if (options.length <= 1) return null

  const go = (next: ReportType) => {
    if (next === current) return
    switch (next) {
      case 'me':
        void navigate({ to: '/reports/me', search: { period } })
        break
      case 'team':
        if (defaultTeamId)
          void navigate({
            to: '/reports/team/$teamId',
            params: { teamId: defaultTeamId },
            search: { period },
          })
        break
      case 'org':
        if (defaultOrgId)
          void navigate({
            to: '/reports/org/$orgId',
            params: { orgId: defaultOrgId },
            search: { period },
          })
        break
      case 'system':
        void navigate({ to: '/reports/system', search: { period } })
        break
    }
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={current}
      onValueChange={(value) => {
        // Radix emits '' when the active item is re-clicked — ignore it.
        if (value) go(value as ReportType)
      }}
    >
      {options.map((type) => {
        const { label, icon: Icon } = META[type]
        return (
          <ToggleGroupItem key={type} value={type} aria-label={label}>
            <Icon className="mr-1.5 h-4 w-4" />
            <span className="text-xs">{label}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
