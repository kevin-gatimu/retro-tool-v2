import { LayoutGrid, Rows3 } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type {
  GroupByMode,
  LayoutMode,
  SessionView,
  SortMode,
} from '@/common/types/user-preferences'

interface ViewConfigToolbarProps {
  view: SessionView
  setView: (patch: Partial<SessionView>) => void
  /** Hide the group-by control where grouping is fixed (e.g. a single tab). */
  showGroupBy?: boolean
  /**
   * Hide the show-completed toggle where it's meaningless — e.g. the estimate
   * tabs already split Active (ongoing) from History (completed).
   */
  showCompletedToggle?: boolean
}

const GROUP_BY_LABELS: Record<GroupByMode, string> = {
  'space-status': 'Space, then status',
  status: 'Status',
  space: 'Space',
  none: 'None',
}

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Most recent',
  oldest: 'Oldest first',
  name: 'Name (A–Z)',
}

/**
 * Compact toolbar to configure the grouped session view: group-by, sort,
 * layout (cards/list) and show-completed. Each control persists immediately
 * via the parent's `setView` (debounced + remembered server-side).
 */
export function ViewConfigToolbar({
  view,
  setView,
  showGroupBy = true,
  showCompletedToggle = true,
}: ViewConfigToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {showGroupBy && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Group</span>
          <Select
            value={view.groupBy}
            onValueChange={(v) => setView({ groupBy: v as GroupByMode })}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GROUP_BY_LABELS) as GroupByMode[]).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {GROUP_BY_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Sort</span>
        <Select
          value={view.sort}
          onValueChange={(v) => setView({ sort: v as SortMode })}
        >
          <SelectTrigger className="h-8 w-38">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view.layout}
        onValueChange={(v) => {
          if (v) setView({ layout: v as LayoutMode })
        }}
        aria-label="Layout"
      >
        <ToggleGroupItem value="cards" aria-label="Card layout">
          <LayoutGrid className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List layout">
          <Rows3 className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      {showCompletedToggle && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-completed"
            checked={view.showCompleted}
            onCheckedChange={(checked) => setView({ showCompleted: checked })}
          />
          <Label htmlFor="show-completed" className="text-xs cursor-pointer">
            Show completed
          </Label>
        </div>
      )}
    </div>
  )
}
