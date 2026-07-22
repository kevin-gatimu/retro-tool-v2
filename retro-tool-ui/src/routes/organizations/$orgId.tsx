import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  LogOut,
  MoreHorizontal,
  Settings,
  Trash2,
} from 'lucide-react'
import { OrgLogo } from '@/components/org-logo'
import { getOrgRoleBadge } from '@/components/user-role-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import { isSystemAdmin } from '@/lib/rbac'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { OrganizationDetail } from '@/common/types/organizations'
import { OrgDetailSkeleton } from './skeleton'
import {
  useBulkRemoveMembers,
  useOrgData,
  useOrgDetailMutations,
  useOrgTeamRoleMutations,
  useOrgTeamRoles,
  useOrgTemplates,
  useRequestToJoinTeam,
  useUserSearch,
} from './hooks'
import type {
  InviteEmailCheckState,
  OrgMemberRoleSelection,
  RoleEditTarget,
} from './types'
import { TeamsTab } from './components/tabs/teams-tab'
import { MembersTab } from './components/tabs/members-tab'
import { TeamRolesTab } from './components/tabs/team-roles-tab'
import { TemplatesTab } from './components/tabs/templates-tab'
import { RoleCreateDialog } from './components/dialogs/role-create-dialog'
import { RoleEditDialog } from './components/dialogs/role-edit-dialog'
import { RoleDeleteDialog } from './components/dialogs/role-delete-dialog'
import { TemplateDeleteDialog } from './components/dialogs/template-delete-dialog'
import { TemplateFormDialog } from './components/dialogs/template-form-dialog'
import { EditOrgDialog } from './components/dialogs/edit-org-dialog'
import { DeleteOrgDialog } from './components/dialogs/delete-org-dialog'
import { LeaveOrgDialog } from './components/dialogs/leave-org-dialog'
import { DeleteTeamDialog } from './components/dialogs/delete-team-dialog'
import { RemoveMemberDialog } from './components/dialogs/remove-member-dialog'

export const Route = createFileRoute('/organizations/$orgId')({
  loader: ({ context: { queryClient }, params: { orgId } }) =>
    void queryClient.prefetchQuery({
      queryKey: ['organization', orgId] as const,
      queryFn: () =>
        api.get<OrganizationDetail>(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId)),
    }),
  pendingComponent: OrgDetailSkeleton,
  component: OrganizationDetailPage,
})

function OrganizationDetailPage() {
  const { orgId } = Route.useParams()
  const { data: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()

  const { organization, teams, isTeamLeadInOrg } = useOrgData(orgId)

  const [activeTab, setActiveTab] = useState('teams')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)
  const [memberRowSelection, setMemberRowSelection] = useState<
    Record<string, boolean>
  >({})
  const selectedMemberIds = Object.keys(memberRowSelection).filter(
    (id) => memberRowSelection[id],
  )
  const [memberFilter, setMemberFilter] = useState<'all' | 'unassigned'>('all')

  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editLogo, setEditLogo] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgMemberRoleSelection>('member')
  const [inviteEmailCheck, setInviteEmailCheck] =
    useState<InviteEmailCheckState>(null)
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] =
    useState<OrgMemberRoleSelection>('member')
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [teamEmoji, setTeamEmoji] = useState('👥')

  // Team roles tab state
  const [roleCreateOpen, setRoleCreateOpen] = useState(false)
  const [roleEditTarget, setRoleEditTarget] = useState<RoleEditTarget>(null)
  const [roleFormName, setRoleFormName] = useState('')
  const [roleFormSortOrder, setRoleFormSortOrder] = useState(0)
  const [roleDeleteId, setRoleDeleteId] = useState<string | null>(null)

  const viewerIsSystemAdmin = currentUser?.role
    ? isSystemAdmin(currentUser.role)
    : false
  const isOwner = organization.myRole === 'org-owner'
  const isAdmin =
    viewerIsSystemAdmin || organization.myRole === 'org-admin' || isOwner
  const canDeleteOrganization = viewerIsSystemAdmin || isOwner
  const canLeaveOrganization = !viewerIsSystemAdmin && !isOwner

  const {
    updateOrgMutation,
    deleteOrgMutation,
    leaveOrgMutation,
    inviteOrgMemberMutation,
    addOrgMemberMutation,
    updateRoleMutation,
    removeMemberMutation,
    createTeamMutation,
    deleteTeamMutation,
  } = useOrgDetailMutations(orgId)

  const {
    createCustomRoleMutation,
    updateCustomRoleMutation,
    deleteCustomRoleMutation,
    toggleActivationMutation,
  } = useOrgTeamRoleMutations(orgId)

  const { data: orgRolesData } = useOrgTeamRoles(orgId, isAdmin)

  const userSearchQuery = useUserSearch(addMemberSearch)

  const requestToJoinTeamMutation = useRequestToJoinTeam(orgId)

  const bulkRemoveMembersMutation = useBulkRemoveMembers({
    orgId,
    selectedMemberIds,
    onCleared: () => setMemberRowSelection({}),
  })

  const orgMembers = organization.members
  const filteredOrgMembers = useMemo(() => {
    if (memberFilter === 'unassigned') {
      return orgMembers.filter((m) => m.teamIds.length === 0)
    }
    return orgMembers
  }, [orgMembers, memberFilter])

  const {
    orgTemplates,
    templateDialogOpen,
    setTemplateDialogOpen,
    editingTemplateId,
    tplName,
    setTplName,
    tplDescription,
    setTplDescription,
    tplColumns,
    setTplColumns,
    sortedTplColumns,
    tplFormError,
    templateToDelete,
    setTemplateToDelete,
    resetTplForm,
    openCreateTemplateDialog,
    openEditTemplateDialog,
    createTemplateMutation,
    updateTemplateMutation,
    deleteTemplateMutation,
    submitTemplate,
  } = useOrgTemplates(orgId)

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/organizations"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Organizations
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <OrgLogo
              logo={organization.logo}
              name={organization.name}
              height={32}
              tight
            />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {organization.name}
              </h1>
              <p className="text-muted-foreground">/{organization.slug}</p>
            </div>
            {getOrgRoleBadge(organization.myRole, currentUser?.role)}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditName(organization.name)
                    setEditSlug(organization.slug)
                    setEditLogo(organization.logo ?? '')
                    setIsEditOpen(true)
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Organization
                </DropdownMenuItem>
              )}
              {canLeaveOrganization && (
                <DropdownMenuItem
                  onClick={() => setLeaveConfirmOpen(true)}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave Organization
                </DropdownMenuItem>
              )}
              {canDeleteOrganization && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Organization
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="team-roles">Team Roles</TabsTrigger>}
          {(isAdmin || isTeamLeadInOrg) && (
            <TabsTrigger value="templates">Templates</TabsTrigger>
          )}
        </TabsList>

        <TeamsTab
          teams={teams}
          isAdmin={isAdmin}
          isCreateTeamOpen={isCreateTeamOpen}
          onCreateTeamOpenChange={setIsCreateTeamOpen}
          teamName={teamName}
          onTeamNameChange={setTeamName}
          teamDescription={teamDescription}
          onTeamDescriptionChange={setTeamDescription}
          teamEmoji={teamEmoji}
          onTeamEmojiChange={setTeamEmoji}
          createTeamMutation={createTeamMutation}
          requestToJoinTeamMutation={requestToJoinTeamMutation}
          onDeleteTeam={setDeleteTeamId}
        />

        <MembersTab
          orgId={orgId}
          isAdmin={isAdmin}
          isOwner={isOwner}
          orgMembers={orgMembers}
          filteredOrgMembers={filteredOrgMembers}
          memberFilter={memberFilter}
          onMemberFilterChange={setMemberFilter}
          isInviteOpen={isInviteOpen}
          onInviteOpenChange={setIsInviteOpen}
          inviteEmail={inviteEmail}
          onInviteEmailChange={setInviteEmail}
          inviteRole={inviteRole}
          onInviteRoleChange={setInviteRole}
          inviteEmailCheck={inviteEmailCheck}
          onInviteEmailCheckChange={setInviteEmailCheck}
          inviteOrgMemberMutation={inviteOrgMemberMutation}
          isAddMemberOpen={isAddMemberOpen}
          onAddMemberOpenChange={setIsAddMemberOpen}
          addMemberSearch={addMemberSearch}
          onAddMemberSearchChange={setAddMemberSearch}
          addMemberUserId={addMemberUserId}
          onAddMemberUserIdChange={setAddMemberUserId}
          addMemberRole={addMemberRole}
          onAddMemberRoleChange={setAddMemberRole}
          userSearchQuery={userSearchQuery}
          addOrgMemberMutation={addOrgMemberMutation}
          updateRoleMutation={updateRoleMutation}
          onRemoveMember={setRemoveMemberId}
          memberRowSelection={memberRowSelection}
          onRowSelectionChange={setMemberRowSelection}
          selectedMemberIds={selectedMemberIds}
          bulkRemoveMembersMutation={bulkRemoveMembersMutation}
          onRefreshMembers={() =>
            queryClient.invalidateQueries({
              queryKey: ['organization', orgId],
            })
          }
        />

        {isAdmin && (
          <TeamRolesTab
            orgRolesData={orgRolesData}
            toggleActivationMutation={toggleActivationMutation}
            onOpenCreateRole={() => {
              setRoleFormName('')
              setRoleFormSortOrder((orgRolesData?.custom.length ?? 0) + 1)
              setRoleCreateOpen(true)
            }}
            onEditRole={setRoleEditTarget}
            onSetRoleFormName={setRoleFormName}
            onSetRoleFormSortOrder={setRoleFormSortOrder}
            onDeleteRole={setRoleDeleteId}
          />
        )}

        {(isAdmin || isTeamLeadInOrg) && (
          <TemplatesTab
            orgId={orgId}
            canManage={isAdmin || isTeamLeadInOrg}
            orgTemplates={orgTemplates}
            onCreateTemplate={openCreateTemplateDialog}
            onEditTemplate={openEditTemplateDialog}
            onDeleteTemplate={setTemplateToDelete}
          />
        )}
      </Tabs>

      {/* Org Custom Role — Create Dialog */}
      <RoleCreateDialog
        open={roleCreateOpen}
        onOpenChange={setRoleCreateOpen}
        roleFormName={roleFormName}
        onRoleFormNameChange={setRoleFormName}
        roleFormSortOrder={roleFormSortOrder}
        onRoleFormSortOrderChange={setRoleFormSortOrder}
        createCustomRoleMutation={createCustomRoleMutation}
      />

      {/* Org Custom Role — Edit Dialog */}
      <RoleEditDialog
        roleEditTarget={roleEditTarget}
        onClose={() => setRoleEditTarget(null)}
        roleFormName={roleFormName}
        onRoleFormNameChange={setRoleFormName}
        roleFormSortOrder={roleFormSortOrder}
        onRoleFormSortOrderChange={setRoleFormSortOrder}
        updateCustomRoleMutation={updateCustomRoleMutation}
      />

      {/* Org Custom Role — Delete Confirmation */}
      <RoleDeleteDialog
        roleDeleteId={roleDeleteId}
        onClose={() => setRoleDeleteId(null)}
        deleteCustomRoleMutation={deleteCustomRoleMutation}
      />

      {/* Template Delete Confirmation */}
      <TemplateDeleteDialog
        templateToDelete={templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={(id) => deleteTemplateMutation.mutate(id)}
      />

      {/* Template Create / Edit Dialog */}
      <TemplateFormDialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open)
          if (!open) resetTplForm()
        }}
        editingTemplateId={editingTemplateId}
        tplName={tplName}
        onTplNameChange={setTplName}
        tplDescription={tplDescription}
        onTplDescriptionChange={setTplDescription}
        tplColumns={tplColumns}
        onTplColumnsChange={setTplColumns}
        sortedTplColumns={sortedTplColumns}
        tplFormError={tplFormError}
        onCancel={() => {
          setTemplateDialogOpen(false)
          resetTplForm()
        }}
        onSubmit={submitTemplate}
        isSaving={
          createTemplateMutation.isPending || updateTemplateMutation.isPending
        }
      />

      {/* Edit Organization Dialog */}
      <EditOrgDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editName={editName}
        onEditNameChange={setEditName}
        editSlug={editSlug}
        onEditSlugChange={setEditSlug}
        editLogo={editLogo}
        onEditLogoChange={setEditLogo}
        updateOrgMutation={updateOrgMutation}
      />

      {/* Delete Organization Confirm */}
      <DeleteOrgDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        organizationName={organization.name}
        deleteOrgMutation={deleteOrgMutation}
      />

      {/* Leave Organization Confirm */}
      <LeaveOrgDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        organizationName={organization.name}
        leaveOrgMutation={leaveOrgMutation}
      />

      {/* Delete Team Confirm */}
      <DeleteTeamDialog
        deleteTeamId={deleteTeamId}
        onClose={() => setDeleteTeamId(null)}
        deleteTeamMutation={deleteTeamMutation}
      />

      {/* Remove Member Confirm */}
      <RemoveMemberDialog
        removeMemberId={removeMemberId}
        onClose={() => setRemoveMemberId(null)}
        removeMemberMutation={removeMemberMutation}
      />
    </div>
  )
}
