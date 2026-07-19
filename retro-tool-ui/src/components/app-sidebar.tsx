import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronsUpDown, Laptop, LogOut, Moon, Sun } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AccountSwitcher } from '@/components/account-switcher'
import { CollapsibleNavGroup } from '@/components/collapsible-nav-group'
import {
  adminNavItems,
  ceremonyNavItems,
  engagementNavItems,
  libraryNavItems,
  mainNavItems,
  userNavItems,
} from '@/components/app-sidebar-nav-items'
import { useTheme } from '@/hooks/use-theme'
import { api } from '@/lib/api'
import {
  POLLS_ENDPOINTS,
  SURVEYS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { authClient, signOutWithCleanup } from '@/lib/auth-client'
import { canAccessAdminPanel } from '@/lib/rbac'
import { usesConvexForSurveys, usesConvexForPolls } from '@/lib/realtime-config'
import { SurveyListConvexSync } from '@/routes/surveys/components/survey-list-convex-sync'
import { PollListConvexSync } from '@/routes/polls/components/poll-list-convex-sync'
import { USER_ROLES } from '@/common/enums/user.enums'
import type { TUserRole } from '@/common/enums/user.enums'
import type { User as AppUser } from '@/common/types/users'

// Subscribe to nothing, just return true after hydration
const subscribeHydration = () => () => {}
const getHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot,
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useHydrated()

  const currentValue = mounted ? theme : 'system'

  return (
    <ToggleGroup
      type="single"
      value={currentValue}
      onValueChange={(value) => {
        if (value) setTheme(value as 'light' | 'dark' | 'system')
      }}
      className="w-full justify-between"
    >
      <ToggleGroupItem
        value="light"
        aria-label="Light theme"
        className="flex-1 gap-1"
      >
        <Sun className="h-4 w-4" />
        <span className="text-xs">Light</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="dark"
        aria-label="Dark theme"
        className="flex-1 gap-1"
      >
        <Moon className="h-4 w-4" />
        <span className="text-xs">Dark</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="system"
        aria-label="System theme"
        className="flex-1 gap-1"
      >
        <Laptop className="h-4 w-4" />
        <span className="text-xs">Auto</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function AppSidebar() {
  const { data: session } = authClient.useSession()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const enabled = !!session?.user

  const { data: user } = useQuery<AppUser | null>({
    queryKey: ['sidebar-user'],
    queryFn: () => api.get<AppUser>(USERS_ENDPOINTS.ME),
    enabled,
  })

  const surveysConvexRealtime = usesConvexForSurveys()
  const pollsConvexRealtime = usesConvexForPolls()

  const { data: surveysActive } = useQuery({
    queryKey: ['surveys-active-count'],
    queryFn: () => api.get<{ count: number }>(SURVEYS_ENDPOINTS.ACTIVE_COUNT),
    enabled,
    staleTime: 30_000,
    refetchInterval: surveysConvexRealtime ? false : 30_000,
  })

  const { data: pollsActive } = useQuery({
    queryKey: ['polls-active-count'],
    queryFn: () => api.get<{ count: number }>(POLLS_ENDPOINTS.ACTIVE_COUNT),
    enabled,
    staleTime: 30_000,
    refetchInterval: pollsConvexRealtime ? false : 30_000,
  })

  const activeSurveyCount = surveysActive?.count ?? 0
  const activePollCount = pollsActive?.count ?? 0

  const currentUserRole: TUserRole = user?.role ?? USER_ROLES.Member
  const isAdmin = canAccessAdminPanel(currentUserRole)

  const visibleMainNavItems = mainNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleCeremonyNavItems = ceremonyNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleEngagementNavItems = engagementNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleLibraryNavItems = libraryNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleUserNavItems = userNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )

  const isActive = (url: string) => {
    if (url === '/') {
      return currentPath === '/'
    }
    return currentPath.startsWith(url)
  }

  const handleSignOut = async () => {
    await signOutWithCleanup()
    window.location.href = '/auth/sign-in'
  }

  return (
    <Sidebar className="border-r border-border">
      {enabled && surveysConvexRealtime ? <SurveyListConvexSync /> : null}
      {enabled && pollsConvexRealtime ? <PollListConvexSync /> : null}
      <SidebarHeader className="border-b border-border px-6 py-4">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <img
            src="/Retro-Tool-Logo.jpg"
            alt="Retro-Tool"
            className="h-8 w-8 rounded-md object-cover shrink-0"
          />
          <span className="font-bold text-xl text-primary">Retro-Tool</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <CollapsibleNavGroup
          label="Ceremonies"
          items={visibleCeremonyNavItems}
          isActive={isActive}
        />

        <CollapsibleNavGroup
          label="Engagement"
          items={visibleEngagementNavItems}
          isActive={isActive}
          collapsedBadgeCount={activePollCount + activeSurveyCount}
          renderBadge={(item) => {
            const countByUrl: Record<string, number> = {
              '/surveys': activeSurveyCount,
              '/polls': activePollCount,
            }
            const count = countByUrl[item.url] ?? 0
            if (count <= 0) return null
            return (
              <Badge
                variant="default"
                className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs flex items-center justify-center animate-in zoom-in animate-pulse"
              >
                {count > 9 ? '9+' : count}
              </Badge>
            )
          }}
        />

        <CollapsibleNavGroup
          label="Library"
          items={visibleLibraryNavItems}
          isActive={isActive}
        />

        <CollapsibleNavGroup
          label="Account"
          items={visibleUserNavItems}
          isActive={isActive}
        />

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Theme Toggle */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Theme</span>
          </div>
          <ThemeToggle />
        </div>

        {session?.user ? (
          <div className="space-y-2 px-3 pb-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent"
                    >
                      <UserAvatar
                        image={session.user.image}
                        name={session.user.name}
                        userId={session.user.id}
                        size="md"
                      />
                      <span className="truncate font-semibold">
                        {session.user.name}
                      </span>
                      <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    className="w-[--radix-popper-anchor-width]"
                  >
                    <AccountSwitcher currentUserId={session.user.id} />
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {__APP_VERSION__}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/auth/sign-in">Sign in</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
