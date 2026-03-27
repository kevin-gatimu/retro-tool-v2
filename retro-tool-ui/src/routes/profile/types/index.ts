export type UserData = {
  id: string
  name: string
  email: string
  createdAt?: Date | string
}

export type SessionData = {
  token: string
  userAgent: string
  ipAddress: string
  createdAt: string | Date
  updatedAt: string | Date
}
