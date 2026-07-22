import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTeamInvitationColumns } from '@/components/tables/invitation-columns'
import { DataTable } from '@/components/ui/data-table'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { PaginatedTeamInvitationsResponse } from '../types'

export function TeamInvitationsSection({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const invitationsQuery = useQuery({
    queryKey: ['team-invitations', teamId, page, pageSize],
    queryFn: () =>
      api.get<PaginatedTeamInvitationsResponse>(
        `${TEAMS_ENDPOINTS.INVITATIONS(teamId)}?page=${page}&limit=${pageSize}`,
      ),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(TEAMS_ENDPOINTS.REVOKE_INVITATION(teamId, invitationId)),
    onSuccess: () => {
      toast.success('Invitation revoked')
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.post(TEAMS_ENDPOINTS.RESEND_INVITATION(teamId, invitationId)),
    onSuccess: () => {
      toast.success('Invitation resent')
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const data = invitationsQuery.data

  if (!data || (data.total === 0 && !invitationsQuery.isFetching)) return null

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Mail className="h-5 w-5" />
        Pending Invitations ({data.total})
      </h2>
      <DataTable
        columns={getTeamInvitationColumns({
          onResend: (id) => resendMutation.mutate(id),
          onRevoke: (id) => revokeMutation.mutate(id),
        })}
        data={data.invitations}
        searchColumn="email"
        searchPlaceholder="Search invitations by email..."
        manualPagination
        pageCount={data.totalPages}
        rowCount={data.total}
        paginationState={{ pageIndex: page - 1, pageSize }}
        onPaginationChange={(p) => {
          setPage(p.pageIndex + 1)
          setPageSize(p.pageSize)
        }}
        isFetching={invitationsQuery.isFetching}
        onRefresh={() => invitationsQuery.refetch()}
        defaultPageSize={10}
      />
    </div>
  )
}
