export const EMAIL_LOG_TYPES = {
  Verification: 'verification',
  WeeklyDigest: 'weekly_digest',
  RetroReminder: 'retro_reminder',
  TeamActivity: 'team_activity',
} as const

export type TEmailLogType =
  (typeof EMAIL_LOG_TYPES)[keyof typeof EMAIL_LOG_TYPES]

export const EMAIL_LOG_STATUSES = {
  Sent: 'sent',
  Bounced: 'bounced',
  Failed: 'failed',
} as const

export type TEmailLogStatus =
  (typeof EMAIL_LOG_STATUSES)[keyof typeof EMAIL_LOG_STATUSES]
