import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Shield,
  Spade,
  Sparkles,
  User,
  Users,
  Vote,
} from 'lucide-react'
import { USER_ROLES } from '@/common/enums/user.enums'
import type { TUserRole } from '@/common/enums/user.enums'

export type NavItem = {
  title: string
  url: string
  icon: typeof LayoutDashboard
  allowedRoles: TUserRole[]
}

const ALL_ROLES: TUserRole[] = [
  USER_ROLES.SuperAdmin,
  USER_ROLES.SystemAdmin,
  USER_ROLES.OrgAdmin,
  USER_ROLES.TeamLead,
  USER_ROLES.Member,
]

export const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ALL_ROLES,
  },
]

// Core recurring team ceremonies.
export const ceremonyNavItems: NavItem[] = [
  {
    title: 'Retrospectives',
    url: '/retros',
    icon: History,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Story Estimate',
    url: '/estimate',
    icon: Spade,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Standups',
    url: '/standups',
    icon: CalendarCheck,
    allowedRoles: ALL_ROLES,
  },
]

// Lighter interactive / feedback tools.
export const engagementNavItems: NavItem[] = [
  {
    title: 'Icebreakers',
    url: '/icebreakers',
    icon: Sparkles,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Polls',
    url: '/polls',
    icon: Vote,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Surveys',
    url: '/surveys',
    icon: ClipboardList,
    allowedRoles: ALL_ROLES,
  },
]

// Templates + Reports form their own small group, visually separated from the
// session tools above.
export const libraryNavItems: NavItem[] = [
  {
    title: 'Templates',
    url: '/templates',
    icon: FileText,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Reports',
    url: '/reports',
    icon: BarChart3,
    allowedRoles: ALL_ROLES,
  },
]

export const userNavItems: NavItem[] = [
  {
    title: 'Organizations',
    url: '/organizations',
    icon: Building2,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Teams',
    url: '/teams',
    icon: Users,
    allowedRoles: ALL_ROLES,
  },
  {
    title: 'Profile',
    url: '/profile',
    icon: User,
    allowedRoles: ALL_ROLES,
  },
]

export const adminNavItems: NavItem[] = [
  {
    title: 'Admin Panel',
    url: '/admin',
    icon: Shield,
    allowedRoles: [USER_ROLES.SuperAdmin, USER_ROLES.SystemAdmin],
  },
]
