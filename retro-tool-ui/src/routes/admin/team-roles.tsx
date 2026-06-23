import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { TEAM_ROLES_ENDPOINTS } from '@/lib/api-endpoints'
import { useAdminTeamRoleMutations } from './hooks/use-admin-team-role-mutations'
import { AdminTeamRolesSkeleton } from './skeleton'

interface TeamRole {
  id: string
  name: string
  isBuiltIn: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const Route = createFileRoute('/admin/team-roles')({
  pendingComponent: AdminTeamRolesSkeleton,
  component: AdminTeamRolesPage,
})

function AdminTeamRolesPage() {
  const { createMutation, updateMutation, deleteMutation, seedMutation } =
    useAdminTeamRoleMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const [editRole, setEditRole] = useState<TeamRole | null>(null)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  const { data: roles = [], isLoading } = useQuery<TeamRole[]>({
    queryKey: ['admin-team-roles'],
    queryFn: () => api.get(TEAM_ROLES_ENDPOINTS.LIST),
  })

  function openCreate() {
    setFormName('')
    setFormSortOrder(roles.length + 1)
    setFormIsActive(true)
    setCreateOpen(true)
  }

  function openEdit(role: TeamRole) {
    setFormName(role.name)
    setFormSortOrder(role.sortOrder)
    setFormIsActive(role.isActive)
    setEditRole(role)
  }

  function handleCreate() {
    createMutation.mutate(
      {
        name: formName.trim(),
        sortOrder: formSortOrder,
        isActive: formIsActive,
      },
      { onSuccess: () => setCreateOpen(false) },
    )
  }

  function handleUpdate() {
    if (!editRole) return
    updateMutation.mutate(
      {
        id: editRole.id,
        payload: {
          name: formName.trim(),
          sortOrder: formSortOrder,
          isActive: formIsActive,
        },
      },
      { onSuccess: () => setEditRole(null) },
    )
  }

  function handleToggleActive(role: TeamRole) {
    updateMutation.mutate({
      id: role.id,
      payload: { isActive: !role.isActive },
    })
  }

  function handleDelete() {
    if (!deleteRoleId) return
    deleteMutation.mutate(deleteRoleId, {
      onSuccess: () => setDeleteRoleId(null),
    })
  }

  if (isLoading) return <AdminTeamRolesSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Team Roles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage built-in team roles available across all organisations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Seed Built-in Roles
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Built-in Roles</CardTitle>
          <CardDescription>
            {roles.length} role{roles.length !== 1 ? 's' : ''} — org admins can
            activate or deactivate these per organisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{role.name}</span>
                  <Badge variant="outline" className="text-xs">
                    #{role.sortOrder}
                  </Badge>
                  {!role.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={role.isActive}
                    onCheckedChange={() => handleToggleActive(role)}
                    disabled={updateMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(role)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteRoleId(role.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {roles.length === 0 && (
              <p className="py-6 text-center text-muted-foreground text-sm">
                No built-in roles configured. Click "Seed Built-in Roles" to
                populate the defaults.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Built-in Role</DialogTitle>
            <DialogDescription>
              This role will be available to all organisations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Data Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="create-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="create-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update this built-in role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteRoleId}
        onOpenChange={(o) => !o && setDeleteRoleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This role will be permanently removed. If any team members are
              currently assigned this role, the deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
