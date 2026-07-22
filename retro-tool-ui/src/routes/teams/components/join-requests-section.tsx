import { Check } from 'lucide-react'
import { getJoinRequestColumns } from '@/components/tables/member-columns'
import type { JoinRequestRow } from '@/components/tables/member-columns'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { TeamJoinRequest } from '@/common/types/teams'
import type { TeamMutations } from '../types'

interface JoinRequestsSectionProps {
  joinRequests: TeamJoinRequest[]
  selectedRequestIds: string[]
  onSelectedRequestIdsChange: (ids: string[]) => void
  approveRequestMutation: TeamMutations['approveRequestMutation']
  rejectRequestMutation: TeamMutations['rejectRequestMutation']
  bulkApproveRequestsMutation: TeamMutations['bulkApproveRequestsMutation']
}

export function JoinRequestsSection({
  joinRequests,
  selectedRequestIds,
  onSelectedRequestIdsChange,
  approveRequestMutation,
  rejectRequestMutation,
  bulkApproveRequestsMutation,
}: JoinRequestsSectionProps) {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Pending Requests ({joinRequests.length})
        </h2>
        {selectedRequestIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRequestIds.length} selected
            </span>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() =>
                bulkApproveRequestsMutation.mutate(selectedRequestIds)
              }
              disabled={bulkApproveRequestsMutation.isPending}
            >
              <Check className="mr-1 h-3 w-3" />
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectedRequestIdsChange([])}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
      <DataTable
        columns={getJoinRequestColumns({
          onApprove: (requestId) => approveRequestMutation.mutate(requestId),
          onReject: (requestId) => rejectRequestMutation.mutate(requestId),
          isApproving: approveRequestMutation.isPending,
          isRejecting: rejectRequestMutation.isPending,
        })}
        data={joinRequests as JoinRequestRow[]}
        getRowId={(row) => row.id}
        searchColumn="user"
        searchPlaceholder="Search requests..."
        defaultPageSize={5}
        rowSelection={Object.fromEntries(
          selectedRequestIds.map((id) => [id, true]),
        )}
        onRowSelectionChange={(selection) =>
          onSelectedRequestIdsChange(
            Object.entries(selection)
              .filter(([, v]) => v)
              .map(([id]) => id),
          )
        }
      />
    </div>
  )
}
