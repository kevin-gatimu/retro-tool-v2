export const EMAIL_LOG_TYPES = {
  Verification: 'verification',
  AccountApproved: 'account_approved',
  OrgInvite: 'org_invite',
  OrgInviteExternal: 'org_invite_external',
  TeamInvite: 'team_invite',
  TeamInviteExternal: 'team_invite_external',
  RetroReport: 'retro_report',
} as const;

export type TEmailLogType =
  (typeof EMAIL_LOG_TYPES)[keyof typeof EMAIL_LOG_TYPES];

export const EMAIL_LOG_STATUSES = {
  Sent: 'sent',
  Bounced: 'bounced',
  Failed: 'failed',
} as const;

export type TEmailLogStatus =
  (typeof EMAIL_LOG_STATUSES)[keyof typeof EMAIL_LOG_STATUSES];
