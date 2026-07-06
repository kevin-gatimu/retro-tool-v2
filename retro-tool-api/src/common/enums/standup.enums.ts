export const STANDUP_CADENCES = {
  Daily: 'daily',
  Weekly: 'weekly',
  Fortnightly: 'fortnightly',
  Once: 'once',
} as const;

export type TStandupCadence =
  (typeof STANDUP_CADENCES)[keyof typeof STANDUP_CADENCES];

export const STANDUP_SCHEDULE_DAYS = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
} as const;

export type TStandupScheduleDay =
  (typeof STANDUP_SCHEDULE_DAYS)[keyof typeof STANDUP_SCHEDULE_DAYS];
