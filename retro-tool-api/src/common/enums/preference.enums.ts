export const WEEKLY_DIGEST_DAYS = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
} as const;

export type TWeeklyDigestDay =
  (typeof WEEKLY_DIGEST_DAYS)[keyof typeof WEEKLY_DIGEST_DAYS];
