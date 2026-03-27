import {
  Outlet,
  createRootRouteWithContext,
  useLocation,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { authClient } from '@/lib/auth-client'
import { usePushNotifications } from '@/hooks/usePushNotifications'

import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

// Routes that should not show the sidebar (auth pages and public landing pages)
const publicRoutes = ['/']

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Retro-Tool | Team Retrospectives' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const location = useLocation()
  const routerState = useRouterState()

  const currentPath = location.pathname
  const pendingPath = routerState.location.pathname

  const isCurrentPublicRoute = publicRoutes.includes(currentPath)
  const isPendingPublicRoute = pendingPath
    ? publicRoutes.includes(pendingPath)
    : isCurrentPublicRoute
  const isPublicRoute = isCurrentPublicRoute || isPendingPublicRoute

  const isCurrentAuthRoute = currentPath.startsWith('/auth')
  const isPendingAuthRoute = pendingPath
    ? pendingPath.startsWith('/auth')
    : isCurrentAuthRoute
  const isAuthRoute = isCurrentAuthRoute && isPendingAuthRoute

  return (
    <TanStackQueryProvider>
      <ThemeProvider defaultTheme="system">
        {isPublicRoute || isAuthRoute ? (
          <Outlet />
        ) : (
          <>
            {routerState.isLoading && (
              <div className="fixed top-0 left-0 right-0 h-1 bg-primary z-50">
                <div className="h-full w-1/3 bg-primary-foreground animate-[loading-bar_1s_ease-in-out_infinite]" />
              </div>
            )}
            <AuthenticatedLayout />
          </>
        )}
        <Toaster position="top-right" richColors closeButton />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
      </ThemeProvider>
    </TanStackQueryProvider>
  )
}

function AuthenticatedLayout() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  usePushNotifications()

  useEffect(() => {
    if (!sessionPending && !session) {
      const currentPath = window.location.pathname + window.location.search
      const redirect = encodeURIComponent(currentPath)
      window.location.href = `/auth/sign-in?redirect=${redirect}`
    }
  }, [session, sessionPending])

  if (sessionPending) {
    return <AppSkeleton />
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 relative z-40">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto bg-background p-5">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[--sidebar-width] bg-card border-r border-border p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </header>
        <main className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </main>
      </div>
    </div>
  )
}
