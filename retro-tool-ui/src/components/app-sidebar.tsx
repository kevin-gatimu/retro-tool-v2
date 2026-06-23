import { Link, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  ChevronDown,
  FileText,
  History,
  Laptop,
  LayoutDashboard,
  LogOut,
  Moon,
  Shield,
  Spade,
  Sun,
  User,
  Users,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { UserAvatar } from '@/components/user-avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AccountSwitcher } from '@/components/account-switcher'
import { useTheme } from '@/hooks/use-theme'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { authClient } from '@/lib/auth-client'
import { canAccessAdminPanel } from '@/lib/rbac'
import { USER_ROLES } from '@/common/enums/user.enums'
import type { TUserRole } from '@/common/enums/user.enums'
import type { User as AppUser } from '@/common/types/users'

type NavItem = {
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

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ALL_ROLES,
  },
]

const retroNavItems: NavItem[] = [
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
    title: 'Templates',
    url: '/templates',
    icon: FileText,
    allowedRoles: ALL_ROLES,
  },
]

const reportsNavItems: NavItem[] = [
  {
    title: 'Reports',
    url: '/reports',
    icon: BarChart3,
    allowedRoles: [
      USER_ROLES.SuperAdmin,
      USER_ROLES.SystemAdmin,
      USER_ROLES.OrgAdmin,
      USER_ROLES.TeamLead,
      USER_ROLES.Member,
    ],
  },
]

const userNavItems: NavItem[] = [
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

const adminNavItems: NavItem[] = [
  {
    title: 'Admin Panel',
    url: '/admin',
    icon: Shield,
    allowedRoles: [USER_ROLES.SuperAdmin, USER_ROLES.SystemAdmin],
  },
]

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

  const currentUserRole: TUserRole = user?.role ?? USER_ROLES.Member
  const isAdmin = canAccessAdminPanel(currentUserRole)

  const visibleMainNavItems = mainNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleRetroNavItems = retroNavItems.filter((item) =>
    item.allowedRoles.includes(currentUserRole),
  )
  const visibleReportsNavItems = reportsNavItems.filter((item) =>
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
    const { signOutWithCleanup } = await import('@/lib/auth-client')
    await signOutWithCleanup()
    window.location.href = '/auth/sign-in'
  }

  return (
    <Sidebar className="border-r border-border">
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleRetroNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {visibleReportsNavItems.map((item) => (
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

        <Collapsible defaultOpen asChild className="group/account-section">
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2" asChild>
              <CollapsibleTrigger className="cursor-pointer">
                <User className="h-4 w-4" />
                Account
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/account-section:rotate-0 group-data-[state=closed]/account-section:-rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleUserNavItems.map((item) => (
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

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
