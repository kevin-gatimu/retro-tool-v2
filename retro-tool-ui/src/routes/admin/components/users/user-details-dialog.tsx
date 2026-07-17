import {
  AlertTriangle,
  Building2,
  Crown,
  History as HistoryIcon,
  RefreshCw,
  Shield,
  Star,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import type { UserRow } from '@/components/tables/user-columns'
import { RoleBadge, StatusBadge } from '@/components/tables/user-columns'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ActionIcon, ActionLabel } from '../../helpers'
import type { UserDetails } from '../../types'

interface UserDetailsDialogProps {
  detailsModalUser: UserRow | null
  userDetails: UserDetails | null
  userDetailsError: boolean
  onClose: () => void
}

export function UserDetailsDialog({
  detailsModalUser,
  userDetails,
  userDetailsError,
  onClose,
}: UserDetailsDialogProps) {
  return (
    <Dialog open={!!detailsModalUser} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {userDetails ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <UserAvatar
                image={userDetails.user.image}
                name={userDetails.user.name}
                userId={userDetails.user.id}
                size="xl"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  {userDetails.user.name}
                </h3>
                <p className="text-muted-foreground">
                  {userDetails.user.email}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={userDetails.user.status} />
                  <RoleBadge role={userDetails.user.role} />
                </div>
              </div>
            </div>

            {userDetails.user.bio && (
              <div>
                <h4 className="mb-1 font-medium">Bio</h4>
                <p className="text-sm text-muted-foreground">
                  {userDetails.user.bio}
                </p>
              </div>
            )}

            {userDetails.user.status === 'suspended' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Account Suspended</span>
                </div>
                {userDetails.user.suspendedReason && (
                  <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">
                    Reason: {userDetails.user.suspendedReason}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Suspended on{' '}
                  {userDetails.user.suspendedAt
                    ? new Date(userDetails.user.suspendedAt).toLocaleString()
                    : 'Unknown'}
                </p>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4" />
                Organizations ({userDetails.organizations.length})
              </h4>
              {userDetails.organizations.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.organizations.map((om) => (
                    <div
                      key={om.id}
                      className="flex items-center justify-between rounded bg-muted p-2"
                    >
                      <span>{om.organization.name}</span>
                      {om.role === 'org-owner' ? (
                        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Crown className="h-3 w-3" />
                          Org Owner
                        </Badge>
                      ) : om.role === 'org-admin' ? (
                        <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          <Shield className="h-3 w-3" />
                          Org Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <User className="h-3 w-3" />
                          Member
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not a member of any organizations
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <Users className="h-4 w-4" />
                Teams ({userDetails.teams.length})
              </h4>
              {userDetails.teams.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.teams.map((tm) => (
                    <div
                      key={tm.id}
                      className="flex items-center justify-between rounded bg-muted p-2"
                    >
                      <div>
                        <span>{tm.team.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({tm.team.organization.name})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {tm.tag === 'team-lead' ? (
                          <Badge className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            <Star className="h-3 w-3" />
                            Team Lead
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <User className="h-3 w-3" />
                            Member
                          </Badge>
                        )}
                        {tm.role && (
                          <Badge variant="outline" className="text-xs">
                            {tm.role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not a member of any teams
                </p>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <HistoryIcon className="h-4 w-4" />
                Admin Action History
              </h4>
              {userDetails.actionHistory.length > 0 ? (
                <div className="space-y-2">
                  {userDetails.actionHistory.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <ActionIcon action={log.action} />
                      <span>
                        <ActionLabel action={log.action} /> by {log.admin?.name}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No admin actions on this user
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Joined:</span>{' '}
                {new Date(userDetails.user.createdAt).toLocaleDateString()}
              </div>
              {userDetails.user.lastActiveAt && (
                <div>
                  <span className="text-muted-foreground">Last Active:</span>{' '}
                  {new Date(userDetails.user.lastActiveAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ) : userDetailsError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <XCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm">Failed to load user details.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
