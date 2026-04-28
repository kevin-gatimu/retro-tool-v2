export interface UserNotificationPreferences {
  id: string
  userId: string
  emailVerificationReminders: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdatePreferencesInput {
  emailVerificationReminders?: boolean
}
