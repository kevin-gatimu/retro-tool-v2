import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getOrgInvitationColumns } from '@/components/tables/invitation-columns'
import type { OrgInvitationRow } from '@/components/tables/invitation-columns'
import { DataTable } from '@/components/ui/data-table'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'

export function OrgInvitationsSection({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const invitationsQuery = useQuery({
    queryKey: ['org-invitations', orgId, page, pageSize],
    queryFn: () =>
      api.get<{
        invitations: OrgInvitationRow[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>(
        `${ORGANIZATIONS_ENDPOINTS.INVITATIONS(orgId)}?page=${page}&limit=${pageSize}`,
      ),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(
        ORGANIZATIONS_ENDPOINTS.REVOKE_INVITATION(orgId, invitationId),
      ),
    onSuccess: () => {
      toast.success('Invitation revoked')
      queryClient.invalidateQueries({ queryKey: ['org-invitations', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.post(ORGANIZATIONS_ENDPOINTS.RESEND_INVITATION(orgId, invitationId)),
    onSuccess: () => {
      toast.success('Invitation resent')
      queryClient.invalidateQueries({ queryKey: ['org-invitations', orgId] })
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
        columns={getOrgInvitationColumns({
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
