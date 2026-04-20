import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Plus,
  RefreshCw,
  Search,
  Shield,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { OrgLogo } from '@/components/OrgLogo'
import { useOrganizationMutations } from './hooks/useOrganizationMutations'
import type { PaginatedOrgsResponse } from './types'

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]
const DEFAULT_PAGE_SIZE = 12

export const Route = createFileRoute('/organizations/')({
  component: OrganizationsPage,
})

function OrganizationsPage() {
  const queryClient = useQueryClient()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const adminAccess = user?.role ? isSystemAdmin(user.role) : false

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')

  const {
    data: orgsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['organizations', adminAccess, page, pageSize, search],
    queryFn: () => {
      const base = ORGANIZATIONS_ENDPOINTS.LIST
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      })
      if (adminAccess) params.set('all', 'true')
      const normalizedSearch = search.trim()
      if (normalizedSearch) params.set('search', normalizedSearch)
      return api.get<PaginatedOrgsResponse>(`${base}?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
    enabled: !userLoading,
  })
  const organizations = orgsData?.organizations ?? []
  const total = orgsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const { createOrgMutation } = useOrganizationMutations()

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    setSlug(
      newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
  }

  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ['organizations'] })

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'owner':
        return (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" />
            Owner
          </Badge>
        )
      case 'admin':
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" />
            Member
          </Badge>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            {adminAccess
              ? 'Manage your organizations and teams'
              : 'View your organizations and teams'}
          </p>
        </div>
        {adminAccess && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization to collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name && slug && !createOrgMutation.isPending)
                    createOrgMutation.mutate({ name, slug })
                }}
              >
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Acme Inc."
                      value={name}
                      onChange={handleNameChange}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      placeholder="acme-inc"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in URLs. Only lowercase letters, numbers, and
                      hyphens.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!name || !slug || createOrgMutation.isPending}
                  >
                    {createOrgMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-6 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search organizations"
            className="pl-9"
          />
        </div>
      </div>

      {organizations.length === 0 && !isFetching ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">No organizations yet</h2>
            <p className="mb-4 text-center text-muted-foreground">
              {adminAccess
                ? 'Create your first organization to start collaborating with your team.'
                : 'You are not a member of any organizations yet. Ask an administrator to add you.'}
            </p>
            {adminAccess && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Link
                key={org.id}
                to="/organizations/$orgId"
                params={{ orgId: org.id }}
                className="group"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <OrgLogo logo={org.logo} name={org.name} height={20} />
                        <div>
                          <CardTitle className="text-lg group-hover:underline">
                            {org.name}
                          </CardTitle>
                          <CardDescription>/{org.slug}</CardDescription>
                        </div>
                      </div>
                      {getRoleBadge(org.myRole ?? null)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{org.memberCount} members</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {total > 6 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>
                  Page {page} of {totalPages} &middot; {total} organizations
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
