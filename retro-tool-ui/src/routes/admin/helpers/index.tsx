/**
 * Admin route helper functions and components
 */

import {
  Ban,
  Building2,
  Crown,
  History as HistoryIcon,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  SquareStack,
  Trash2,
  UserCheck,
  Users,
  Wand2,
  XCircle,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/use-current-user'
// Import common helpers
import { slugify, toSlug, createEmptyColumn } from '@/common/helpers'

// Export common helpers for admin route
export { slugify, toSlug, createEmptyColumn }

// ─────────────────────────────────────────────────────────────────────────────
// Admin Navigation
// ─────────────────────────────────────────────────────────────────────────────

const commonAdminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/templates', label: 'Templates', icon: SquareStack },
  { to: '/admin/team-roles', label: 'Team Roles', icon: ShieldCheck },
  { to: '/admin/org-setup', label: 'Org Setup', icon: Wand2 },
] as const

const superAdminLinks = [
  { to: '/admin/convex', label: 'Convex', icon: Zap },
] as const

type AdminNavLink = {
  to: string
  label: string
  icon: LucideIcon
  exact?: true
}

function NavLink({
  link,
  currentPath,
}: {
  link: AdminNavLink
  currentPath: string
}) {
  const active = link.exact
    ? currentPath === link.to
    : currentPath.startsWith(link.to)
  const Icon = link.icon
  return (
    <Link
      key={link.to}
      to={link.to}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {link.label}
    </Link>
  )
}

export function AdminNav() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const { data: currentUser } = useCurrentUser()

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2 mb-6">
      {commonAdminLinks.map((link) => (
        <NavLink key={link.to} link={link} currentPath={currentPath} />
      ))}
      {isSuperAdmin(currentUser?.role) &&
        superAdminLinks.map((link) => (
          <NavLink key={link.to} link={link} currentPath={currentPath} />
        ))}
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-specific helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format action log details JSON into human-readable text
 */
export function formatDetails(details: string): string {
  try {
    const parsed = JSON.parse(details)
    if (parsed.reason) return `Reason: ${parsed.reason}`
    if (parsed.previousRole && parsed.newRole) {
      return `${parsed.previousRole} → ${parsed.newRole}`
    }
    if (parsed.bulk) return 'Bulk action'
    return ''
  } catch {
    return details
  }
}
export function ActionIcon({ action }: { action: string }) {
  const icons: Record<string, React.ReactNode> = {
    user_approved: <UserCheck className="h-4 w-4 text-green-500" />,
    user_rejected: <XCircle className="h-4 w-4 text-red-500" />,
    user_suspended: <Ban className="h-4 w-4 text-orange-500" />,
    user_reactivated: <RefreshCw className="h-4 w-4 text-green-500" />,
    user_role_changed: <Crown className="h-4 w-4 text-amber-500" />,
    user_deleted: <Trash2 className="h-4 w-4 text-red-500" />,
    password_reset_triggered: <RefreshCw className="h-4 w-4 text-blue-500" />,
  }
  return icons[action] || <HistoryIcon className="h-4 w-4" />
}

/**
 * Display human-readable label for admin action
 */
export function ActionLabel({ action }: { action: string }) {
  const labels: Record<string, string> = {
    user_approved: 'approved',
    user_rejected: 'rejected',
    user_suspended: 'suspended',
    user_reactivated: 'reactivated',
    user_role_changed: 'changed role for',
    user_deleted: 'deleted',
    password_reset_triggered: 'triggered password reset for',
  }
  return <span>{labels[action] || action}</span>
}
