import { useNavigate } from '@tanstack/react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ReportPeriod } from '../types'

interface ScopeOption {
  id: string
  name: string
}

interface ReportScopePickerProps {
  /** which report the picker drives */
  scope: 'team' | 'org'
  options: ScopeOption[]
  currentId: string
  period: ReportPeriod
  placeholder?: string
}

/**
 * Secondary picker for report types that scope to one team/org at a time.
 * Lets a user in several teams/orgs switch which one the Team/Org report shows,
 * carrying the current `period`. Hidden when there's nothing to choose between.
 */
export function ReportScopePicker({
  scope,
  options,
  currentId,
  period,
  placeholder,
}: ReportScopePickerProps) {
  const navigate = useNavigate()
  if (options.length <= 1) return null

  const onChange = (id: string) => {
    if (id === currentId) return
    if (scope === 'team') {
      void navigate({
        to: '/reports/team/$teamId',
        params: { teamId: id },
        search: { period },
      })
    } else {
      void navigate({
        to: '/reports/org/$orgId',
        params: { orgId: id },
        search: { period },
      })
    }
  }

  return (
    <Select value={currentId} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder={placeholder ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
