import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  TUserRole as UserRole,
  TUserStatus as UserStatus,
} from '@/common/enums/user.enums'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'

export function useAdminUserMutations({
  selectedUserIds,
  onSuspendSuccess,
  onDeleteSuccess,
  onBulkSuccess,
}: {
  selectedUserIds: string[]
  onSuspendSuccess?: () => void
  onDeleteSuccess?: () => void
  onBulkSuccess?: () => void
}) {
  const queryClient = useQueryClient()

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-action-log'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      api.patch(USERS_ENDPOINTS.STATUS(userId), { status }),
    onSuccess: invalidateUsers,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update user status'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.patch(USERS_ENDPOINTS.ROLE(userId), { role }),
    onSuccess: invalidateUsers,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update user role'),
  })

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      api.post(USERS_ENDPOINTS.SUSPEND(userId), { reason }),
    onSuccess: () => {
      onSuspendSuccess?.()
      invalidateUsers()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to suspend user'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(USERS_ENDPOINTS.REACTIVATE(userId)),
    onSuccess: invalidateUsers,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to reactivate user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(USERS_ENDPOINTS.BY_ID(userId)),
    onSuccess: () => {
      onDeleteSuccess?.()
      invalidateUsers()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete user'),
  })

  const bulkMutation = useMutation({
    mutationFn: ({
      status,
      reason,
    }: {
      status: 'approved' | 'rejected' | 'suspended'
      reason?: string
    }) =>
      api.post(USERS_ENDPOINTS.BULK_STATUS, {
        userIds: selectedUserIds,
        status,
        reason,
      }),
    onSuccess: () => {
      onBulkSuccess?.()
      invalidateUsers()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to bulk update users'),
  })

  const promoteToAdmin = (userId: string) =>
    api
      .post(USERS_ENDPOINTS.PROMOTE_SYSTEM_ADMIN(userId))
      .then(invalidateUsers)
      .catch((error: Error) =>
        toast.error(error.message || 'Failed to promote user'),
      )

  const demoteToMember = (userId: string) =>
    api
      .post(USERS_ENDPOINTS.DEMOTE_SYSTEM_ADMIN(userId))
      .then(invalidateUsers)
      .catch((error: Error) =>
        toast.error(error.message || 'Failed to demote user'),
      )

  return {
    statusMutation,
    roleMutation,
    suspendMutation,
    reactivateMutation,
    deleteMutation,
    bulkMutation,
    promoteToAdmin,
    demoteToMember,
  }
}
