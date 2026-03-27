export const TEAM_MEMBER_ROLES = {
  Dev: 'Dev',
  QA: 'QA',
  QE: 'QE',
  QA_QE: 'QA/QE',
  DevOps: 'DevOps',
  BI_Dev: 'BI-Dev',
  Oversight: 'Oversight',
} as const
export type TTeamMemberRole =
  (typeof TEAM_MEMBER_ROLES)[keyof typeof TEAM_MEMBER_ROLES]

export const TEAM_MEMBER_TAGS = {
  Lead: 'team-lead',
  Member: 'member',
} as const
export type TTeamMemberTag =
  (typeof TEAM_MEMBER_TAGS)[keyof typeof TEAM_MEMBER_TAGS]

export const TEAM_JOIN_REQUEST_STATUSES = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const
export type TTeamJoinRequestStatus =
  (typeof TEAM_JOIN_REQUEST_STATUSES)[keyof typeof TEAM_JOIN_REQUEST_STATUSES]
