import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { NavItem } from './app-sidebar-nav-items'

interface CollapsibleNavGroupProps {
  label: string
  items: NavItem[]
  isActive: (url: string) => boolean
  /** Optional trailing badge per item (used by Engagement for live counts). */
  renderBadge?: (item: NavItem) => ReactNode
  /**
   * A roll-up count surfaced on the group label ONLY while the group is
   * collapsed, so an active indicator (e.g. a live poll) isn't hidden when the
   * section is closed. `0` renders nothing.
   */
  collapsedBadgeCount?: number
}

/**
 * A labelled, collapsible sidebar section. All the session/library/account
 * groups share this shape: a clickable label that expands/collapses the group,
 * a chevron that rotates with state, an optional per-item trailing badge, and
 * an optional roll-up badge shown on the label only while collapsed.
 */
export function CollapsibleNavGroup({
  label,
  items,
  isActive,
  renderBadge,
  collapsedBadgeCount = 0,
}: CollapsibleNavGroupProps) {
  if (items.length === 0) return null

  return (
    <Collapsible defaultOpen asChild className="group/nav-section">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="cursor-pointer">
            {label}
            {collapsedBadgeCount > 0 && (
              <Badge
                variant="default"
                className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs flex items-center justify-center animate-pulse group-data-[state=open]/nav-section:hidden"
              >
                {collapsedBadgeCount > 9 ? '9+' : collapsedBadgeCount}
              </Badge>
            )}
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=closed]/nav-section:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {renderBadge?.(item)}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
