import { Link, useNavigate } from '@tanstack/react-router'
import {
  Clock,
  MoreHorizontal,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TabsContent } from '@/components/ui/tabs'
import type { Team } from '@/common/types/teams'
import type { useOrgDetailMutations, useRequestToJoinTeam } from '../../hooks'

interface TeamsTabProps {
  teams: Team[]
  isAdmin: boolean
  isCreateTeamOpen: boolean
  onCreateTeamOpenChange: (open: boolean) => void
  teamName: string
  onTeamNameChange: (value: string) => void
  teamDescription: string
  onTeamDescriptionChange: (value: string) => void
  teamEmoji: string
  onTeamEmojiChange: (value: string) => void
  createTeamMutation: ReturnType<
    typeof useOrgDetailMutations
  >['createTeamMutation']
  requestToJoinTeamMutation: ReturnType<typeof useRequestToJoinTeam>
  onDeleteTeam: (teamId: string) => void
}

export function TeamsTab({
  teams,
  isAdmin,
  isCreateTeamOpen,
  onCreateTeamOpenChange,
  teamName,
  onTeamNameChange,
  teamDescription,
  onTeamDescriptionChange,
  teamEmoji,
  onTeamEmojiChange,
  createTeamMutation,
  requestToJoinTeamMutation,
  onDeleteTeam,
}: TeamsTabProps) {
  const navigate = useNavigate()

  return (
    <TabsContent value="teams" className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teams</h2>
        {isAdmin && (
          <Dialog open={isCreateTeamOpen} onOpenChange={onCreateTeamOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  Create a new team within this organization.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (teamName && !createTeamMutation.isPending)
                    createTeamMutation.mutate(
                      {
                        name: teamName,
                        description: teamDescription,
                        emoji: teamEmoji,
                      },
                      {
                        onSuccess: () => {
                          onCreateTeamOpenChange(false)
                          onTeamNameChange('')
                          onTeamDescriptionChange('')
                          onTeamEmojiChange('👥')
                        },
                      },
                    )
                }}
              >
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="emoji">Emoji</Label>
                    <Input
                      id="emoji"
                      value={teamEmoji}
                      onChange={(e) => onTeamEmojiChange(e.target.value)}
                      className="w-20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="teamName">Name</Label>
                    <Input
                      id="teamName"
                      placeholder="Engineering"
                      value={teamName}
                      onChange={(e) => onTeamNameChange(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="teamDescription">Description</Label>
                    <Textarea
                      id="teamDescription"
                      placeholder="Our awesome engineering team"
                      value={teamDescription}
                      onChange={(e) => onTeamDescriptionChange(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCreateTeamOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!teamName || createTeamMutation.isPending}
                  >
                    {createTeamMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No teams yet</h3>
            <p className="mb-4 text-center text-muted-foreground">
              Create teams to organize members and run retrospectives.
            </p>
            {isAdmin && (
              <Button onClick={() => onCreateTeamOpenChange(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="group cursor-pointer transition-colors hover:bg-accent/30 hover:ring-1 hover:ring-primary/30"
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (
                  target.closest(
                    'button, a, input, textarea, select, [role="menuitem"]',
                  )
                ) {
                  return
                }

                void navigate({
                  to: '/teams/$teamId',
                  params: { teamId: team.id },
                })
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                const target = e.target as HTMLElement
                if (
                  target.closest(
                    'button, a, input, textarea, select, [role="menuitem"]',
                  )
                ) {
                  return
                }

                e.preventDefault()
                void navigate({
                  to: '/teams/$teamId',
                  params: { teamId: team.id },
                })
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open team ${team.name}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{team.emoji}</span>
                    <div>
                      <CardTitle className="text-lg">
                        <Link
                          to="/teams/$teamId"
                          params={{ teamId: team.id }}
                          className="hover:underline"
                        >
                          {team.name}
                        </Link>
                      </CardTitle>
                      {team.description && (
                        <CardDescription className="line-clamp-2">
                          {team.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onDeleteTeam(team.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {team.memberCount ?? 0}{' '}
                      {team.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  {team.isMember ? (
                    <Badge variant="secondary">Joined</Badge>
                  ) : team.hasPendingRequest ? (
                    <Badge
                      variant="outline"
                      className="gap-1 text-amber-600 border-amber-400"
                    >
                      <Clock className="h-3 w-3" />
                      Request Pending
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-emerald-600 border-emerald-500 hover:bg-emerald-50"
                      onClick={() => requestToJoinTeamMutation.mutate(team.id)}
                      disabled={requestToJoinTeamMutation.isPending}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      Request to Join
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  )
}
