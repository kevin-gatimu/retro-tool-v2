export interface RetroReminder {
  id: string
  teamId: string
  retroId: string | null
  type: 'before_retro' | 'after_retro' | 'custom'
  schedule: string // cron expression or relative time
  message: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  team?: {
    id: string
    name: string
  }
  retro?: {
    id: string
    name: string
  } | null
}

export interface CreateReminderInput {
  teamId: string
  retroId?: string
  type: 'before_retro' | 'after_retro' | 'custom'
  schedule: string
  message?: string
}

export interface UpdateReminderInput {
  type?: 'before_retro' | 'after_retro' | 'custom'
  schedule?: string
  message?: string
  isActive?: boolean
}
