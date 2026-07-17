import { Edit, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TabsContent } from '@/components/ui/tabs'
import type { useOrgTeamRoleMutations } from '../../hooks'
import type { OrgTeamRoleAdminResponse, RoleEditTarget } from '../../types'

interface TeamRolesTabProps {
  orgRolesData: OrgTeamRoleAdminResponse | undefined
  toggleActivationMutation: ReturnType<
    typeof useOrgTeamRoleMutations
  >['toggleActivationMutation']
  onOpenCreateRole: () => void
  onEditRole: (target: NonNullable<RoleEditTarget>) => void
  onSetRoleFormName: (value: string) => void
  onSetRoleFormSortOrder: (value: number) => void
  onDeleteRole: (id: string) => void
}

export function TeamRolesTab({
  orgRolesData,
  toggleActivationMutation,
  onOpenCreateRole,
  onEditRole,
  onSetRoleFormName,
  onSetRoleFormSortOrder,
  onDeleteRole,
}: TeamRolesTabProps) {
  return (
    <TabsContent value="team-roles" className="mt-6 space-y-6">
      {/* Built-in roles section */}
      <div>
        <h2 className="text-xl font-semibold mb-1">Built-in Roles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle which global roles are available in this organisation.
        </p>
        <div className="divide-y border rounded-lg">
          {(orgRolesData?.builtIn ?? []).map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{role.name}</span>
              <div className="flex items-center gap-2">
                {!role.orgIsActive && (
                  <span className="text-xs text-muted-foreground">
                    Deactivated
                  </span>
                )}
                <Switch
                  checked={role.orgIsActive}
                  onCheckedChange={(checked) =>
                    toggleActivationMutation.mutate({
                      id: role.id,
                      isActive: checked,
                    })
                  }
                  disabled={toggleActivationMutation.isPending}
                />
              </div>
            </div>
          ))}
          {(orgRolesData?.builtIn ?? []).length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No built-in roles configured.
            </p>
          )}
        </div>
      </div>

      {/* Custom roles section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Custom Roles</h2>
            <p className="text-sm text-muted-foreground">
              Roles specific to this organisation.
            </p>
          </div>
          <Button size="sm" onClick={onOpenCreateRole}>
            <Plus className="mr-2 h-4 w-4" />
            New Custom Role
          </Button>
        </div>
        <div className="divide-y border rounded-lg">
          {(orgRolesData?.custom ?? []).map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{role.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSetRoleFormName(role.name)
                    onSetRoleFormSortOrder(role.sortOrder)
                    onEditRole({
                      id: role.id,
                      name: role.name,
                      sortOrder: role.sortOrder,
                      isBuiltIn: false,
                    })
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDeleteRole(role.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {(orgRolesData?.custom ?? []).length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No custom roles yet.
            </p>
          )}
        </div>
      </div>
    </TabsContent>
  )
}
