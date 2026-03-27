export interface UserNotificationPreferences {
  id: string
  userId: string
  emailVerificationReminders: boolean
  weeklyDigestEnabled: boolean
  weeklyDigestDay:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
  retrospectiveRemindersEnabled: boolean
  retrospectiveReminderHours: number
  teamActivityEmailsEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdatePreferencesInput {
  emailVerificationReminders?: boolean
  weeklyDigestEnabled?: boolean
  weeklyDigestDay?:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
  retrospectiveRemindersEnabled?: boolean
  retrospectiveReminderHours?: number
  teamActivityEmailsEnabled?: boolean
}
