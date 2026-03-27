// All roles that can exist on an org member (includes owner set at creation)
export const ORG_MEMBER_ROLES = {
  Owner: 'org-owner',
  Admin: 'org-admin',
  Member: 'member',
} as const
export type TOrgMemberRole =
  (typeof ORG_MEMBER_ROLES)[keyof typeof ORG_MEMBER_ROLES]

// Roles that can be assigned via the API (owner is set at org creation only)
export const ORG_ASSIGNABLE_ROLES = {
  Admin: 'org-admin',
  Member: 'member',
} as const
export type TOrgAssignableRole =
  (typeof ORG_ASSIGNABLE_ROLES)[keyof typeof ORG_ASSIGNABLE_ROLES]
