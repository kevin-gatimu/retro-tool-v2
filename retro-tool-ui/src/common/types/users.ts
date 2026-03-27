import type { TUserRole, TUserStatus } from '@/common/enums/user.enums'

export interface User {
  id: string
  name: string
  email: string
  image: string | null
  role: TUserRole
  status: TUserStatus
  bio: string | null
  createdAt: Date | string
  updatedAt?: Date | string
}

export interface SearchUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface PaginatedUsers {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats: {
    pending: number
    approved: number
    suspended: number
    rejected: number
    admins: number
  }
}
