import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { Monitor, Settings, Shield, User } from 'lucide-react'

export const Route = createFileRoute('/profile')({
  component: ProfileLayout,
})

const profileTabs = [
  { label: 'Profile', to: '/profile', icon: User },
  { label: 'Security', to: '/profile/security', icon: Shield },
  { label: 'Sessions', to: '/profile/sessions', icon: Monitor },
  { label: 'Settings', to: '/profile/settings', icon: Settings },
] as const

function ProfileLayout() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (to: string) => {
    if (to === '/profile') {
      return currentPath === '/profile' || currentPath === '/profile/'
    }
    return currentPath.startsWith(to)
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-border">
        {profileTabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive(tab.to)
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
