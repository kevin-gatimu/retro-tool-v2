import { Skeleton } from '@/components/ui/skeleton'

// ============================================================================
// LIST PAGE SKELETONS
// ============================================================================

export function RetrosListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Grid of retro cards - 3 columns on large screens */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            {/* Card header with emoji and team name */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />
            {/* Template name */}
            <Skeleton className="h-4 w-1/2" />
            {/* Footer with status and date */}
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrganizationsListSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Grid of organization cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            {/* Header with logo and role badge */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Member count */}
            <div className="flex items-center gap-2 pt-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TemplatesListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Grid of template cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            {/* Title with built-in badge */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Description */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            {/* Column tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <Skeleton key={j} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminTemplatesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      {/* Table card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DETAIL PAGE SKELETONS
// ============================================================================

export function TeamDetailSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Back link */}
      <Skeleton className="h-5 w-40" />

      {/* Header with emoji, name, and actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Members section header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Members table */}
      <div className="border rounded-lg">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-0"
          >
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrgDetailSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Back link */}
      <Skeleton className="h-5 w-40" />

      {/* Header with logo, name, and menu */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-10" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      {/* Teams tab content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Teams grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RetroDetailSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-3 sm:space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-background via-muted/30 to-background rounded-xl p-3 sm:p-4 border">
        <div className="flex items-center gap-2 sm:gap-4">
          <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-md" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 sm:h-8 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 sm:h-4 w-40" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          {/* Settings badges */}
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Timer */}
          <Skeleton className="h-8 w-24 rounded-lg" />
          {/* Action button */}
          <Skeleton className="h-8 sm:h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Columns Grid - Responsive */}
      <div className="grid flex-1 gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border-2 p-3 sm:p-4 space-y-4 min-h-0"
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 sm:h-5 w-24" />
                  <Skeleton className="h-4 w-8 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 hidden sm:block" />
              </div>
            </div>

            {/* Cards List */}
            <div className="flex-1 space-y-2 sm:space-y-3 overflow-hidden">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Card Input */}
            <div className="border-t pt-3 space-y-2">
              <Skeleton className="h-20 w-full rounded-md" />
              <div className="flex justify-end">
                <Skeleton className="h-7 sm:h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// DASHBOARD PAGE SKELETONS
// ============================================================================

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <aside className="hidden md:block w-64 shrink-0 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Avatar Section */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-card rounded-xl border p-6 space-y-6">
        <Skeleton className="h-6 w-48" />

        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border border-destructive/20 p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

export function SecuritySkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Password Form */}
      <div className="bg-card rounded-xl border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Security Features */}
      <div className="bg-card rounded-xl border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Login Activity */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  )
}

export function SessionsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Notifications Card */}
      <div className="border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-56" />

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Card */}
      <div className="border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-40" />

        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ADMIN PAGE SKELETONS
// ============================================================================

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Grid - 6 compact cards, 2-col mobile, 3-col md+ */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg px-3 py-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Recent Activity - 2 columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-40" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminUsersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-0"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// FORM/WIZARD PAGE SKELETONS
// ============================================================================

export function NewRetroSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-16 ml-2" />
            {i < 3 && <Skeleton className="h-0.5 w-16 mx-4" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px] space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-96" />

        {/* Template/Team Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((__, j) => (
                  <Skeleton key={j} className="h-6 w-20 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

// ============================================================================
// ESTIMATE PAGE SKELETONS
// ============================================================================

export function EstimateSessionsListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Grid of session cards - 3 columns on large screens */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            {/* Card header with title and badge */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Team name */}
            <Skeleton className="h-4 w-1/2" />
            {/* Footer with participants and button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// REPORTS PAGE SKELETONS
// ============================================================================

function MyStatsSkeleton() {
  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamsTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Controls row: team + period + member selects */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-44 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>

      {/* Health score card */}
      <div className="border rounded-lg p-6 space-y-5">
        {/* Card header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          {/* Score badge */}
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
        {/* 4 metric rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* 4 activity mini stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-14" />
          </div>
        ))}
      </div>

      {/* Action items + top assignees row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie chart placeholder */}
        <div className="border rounded-lg p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex items-center justify-center">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
          <div className="flex justify-center gap-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {/* Top assignees list */}
        <div className="border rounded-lg p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrgTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Controls row: org selector + period */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-44 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* 4 summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-14" />
          </div>
        ))}
      </div>

      {/* Team breakdown table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Search input */}
        <div className="p-4 border-b">
          <Skeleton className="h-9 w-64 rounded-md" />
        </div>
        {/* Table header */}
        <div className="flex items-center gap-6 px-4 py-3 bg-muted/50 border-b">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-b last:border-0"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-14" />
          </div>
        ))}
      </div>

      {/* Org breakdown table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-6 px-4 py-3 bg-muted/50 border-b">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-b last:border-0"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Tabs bar */}
      <div className="flex gap-1 border-b pb-0">
        {['My Stats', 'Teams', 'Organization', 'System'].map((tab) => (
          <Skeleton key={tab} className="h-9 w-28 rounded-t-md" />
        ))}
      </div>

      {/* Default tab content — My Stats */}
      <MyStatsSkeleton />
    </div>
  )
}

export { MyStatsSkeleton, TeamsTabSkeleton, OrgTabSkeleton, SystemTabSkeleton }

// ============================================================================
// UTILITY SKELETONS
// ============================================================================

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-0"
        >
          {Array.from({ length: columns }).map((__, j) => (
            <Skeleton key={j} className="h-4 w-24" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// LEGAL PAGE SKELETONS
// ============================================================================

export function LegalPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Sticky header */}
      <div className="h-14 border-b border-white/5 px-6 flex items-center justify-between">
        <Skeleton className="h-5 w-24 bg-white/10" />
        <Skeleton className="h-7 w-28 bg-white/10" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16 bg-white/10" />
          <Skeleton className="h-4 w-20 bg-white/10" />
        </div>
      </div>
      {/* Title block */}
      <div className="px-6 py-12 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-6 w-24 rounded-full bg-white/10" />
        <Skeleton className="h-10 w-80 bg-white/10" />
        <Skeleton className="h-4 w-48 bg-white/10" />
        <Skeleton className="h-5 w-96 bg-white/10" />
      </div>
      {/* Two-column layout */}
      <div className="px-6 pb-16 max-w-4xl mx-auto grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar ToC */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg bg-white/5" />
          ))}
        </div>
        {/* Main content */}
        <div className="space-y-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-7 w-56 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
