export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  metadata: string | null
  createdAt: Date
}
