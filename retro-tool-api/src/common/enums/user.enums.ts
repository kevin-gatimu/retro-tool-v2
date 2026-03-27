export const USER_STATUSES = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Suspended: 'suspended',
} as const;
export type TUserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

// Statuses that can be set via bulk update (excludes 'pending')
export const BULK_UPDATE_STATUSES = {
  Approved: 'approved',
  Rejected: 'rejected',
  Suspended: 'suspended',
} as const;
export type TBulkUpdateStatus =
  (typeof BULK_UPDATE_STATUSES)[keyof typeof BULK_UPDATE_STATUSES];

// For filter parameters that include 'all' option
export const USER_STATUS_FILTERS = {
  ...USER_STATUSES,
  All: 'all',
} as const;
export type TUserStatusFilter =
  (typeof USER_STATUS_FILTERS)[keyof typeof USER_STATUS_FILTERS];

export const USER_ROLES = {
  SuperAdmin: 'super-admin',
  SystemAdmin: 'system-admin',
  OrgAdmin: 'org-admin',
  TeamLead: 'team-lead',
  Member: 'member',
} as const;
export type TUserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// For filter parameters that include 'all' option
export const USER_ROLE_FILTERS = {
  ...USER_ROLES,
  All: 'all',
} as const;
export type TUserRoleFilter =
  (typeof USER_ROLE_FILTERS)[keyof typeof USER_ROLE_FILTERS];

export const ADMIN_ACTION_LOG_ACTIONS = {
  UserApproved: 'user_approved',
  UserRejected: 'user_rejected',
  UserSuspended: 'user_suspended',
  UserReactivated: 'user_reactivated',
  UserRoleChanged: 'user_role_changed',
  UserDeleted: 'user_deleted',
  PasswordResetTriggered: 'password_reset_triggered',
} as const;
export type TAdminActionLogAction =
  (typeof ADMIN_ACTION_LOG_ACTIONS)[keyof typeof ADMIN_ACTION_LOG_ACTIONS];

// Map user status to admin action log action
export const STATUS_TO_ACTION_MAP: Record<
  Exclude<TUserStatus, 'pending'>,
  TAdminActionLogAction
> = {
  [USER_STATUSES.Approved]: ADMIN_ACTION_LOG_ACTIONS.UserApproved,
  [USER_STATUSES.Rejected]: ADMIN_ACTION_LOG_ACTIONS.UserRejected,
  [USER_STATUSES.Suspended]: ADMIN_ACTION_LOG_ACTIONS.UserSuspended,
};

// Helper function to get action from status
export function getAdminActionFromStatus(
  status: Exclude<TUserStatus, 'pending'>,
): TAdminActionLogAction {
  return STATUS_TO_ACTION_MAP[status];
}
