import { useState } from 'react'
import {
  FileDown,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Mail,
  MoreVertical,
  Pencil,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { exportPollPdf } from '@/routes/polls/helpers/export-poll-pdf'
import { PollEmailDialog } from '@/components/polls/poll-email-dialog'
import type { PollView } from '@/common/types/polls'

interface PollCardProps {
  poll: PollView
  onVote: (pollId: string, optionId: string) => void
  onRetractVote: (pollId: string) => void
  onSetClosed: (pollId: string, isClosed: boolean) => void
  onDelete: (pollId: string) => void
  onEdit?: (poll: PollView) => void
  /** Emails results; `recipients` undefined = whole team. Enables the menu item. */
  onEmail?: (pollId: string, recipients?: string[]) => void
  isEmailing?: boolean
  /** Shows team name (useful on the standalone /polls list). */
  showTeam?: boolean
}

export function PollCard({
  poll,
  onVote,
  onRetractVote,
  onSetClosed,
  onDelete,
  onEdit,
  onEmail,
  isEmailing = false,
  showTeam = false,
}: PollCardProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  const canVote = !poll.isClosed

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {poll.isAnonymous ? (
                  <span className="flex items-center gap-1">
                    <EyeOff className="h-3.5 w-3.5" />
                    Anonymous Poll
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Public Poll
                  </span>
                )}
                {showTeam && (
                  <span className="truncate">
                    · {poll.team.emoji ? `${poll.team.emoji} ` : ''}
                    {poll.team.name}
                  </span>
                )}
                {poll.isClosed && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Closed
                  </Badge>
                )}
              </div>
              <p className="font-semibold">{poll.question}</p>
            </div>

            {poll.canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Poll actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(poll)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit poll
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onSetClosed(poll.id, !poll.isClosed)}
                  >
                    {poll.isClosed ? (
                      <>
                        <LockOpen className="mr-2 h-4 w-4" />
                        Reopen poll
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Close poll
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void exportPollPdf(poll)
                    }}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  {onEmail && (
                    <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email results…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete poll
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="space-y-2">
            {poll.options.map((option) => {
              const percent =
                poll.totalVotes > 0
                  ? Math.round((option.voteCount / poll.totalVotes) * 100)
                  : 0

              const bar = (
                <button
                  key={option.id}
                  type="button"
                  disabled={!canVote}
                  onClick={() => onVote(poll.id, option.id)}
                  className={cn(
                    'relative w-full overflow-hidden rounded-md border text-left transition-colors',
                    canVote && 'hover:border-primary/60',
                    option.isOwnVote && 'border-primary',
                  )}
                >
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 transition-all',
                      option.isOwnVote ? 'bg-primary/20' : 'bg-muted',
                    )}
                    style={{ width: `${percent}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      {option.emoji ? <span>{option.emoji}</span> : null}
                      <span className="truncate">{option.label}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">
                      {percent}%
                    </span>
                  </div>
                </button>
              )

              if (poll.isAnonymous || option.voters.length === 0) {
                return bar
              }

              return (
                <Tooltip key={option.id}>
                  <TooltipTrigger asChild>{bar}</TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56">
                    <p className="mb-1 font-medium">
                      {option.voteCount} vote{option.voteCount === 1 ? '' : 's'}
                      {' · '}
                      {percent}%
                    </p>
                    <p className="text-xs">
                      {option.voters.map((voter) => voter.name).join(', ')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {poll.totalVotes} voted
              {poll.createdBy ? ` · Creator: ${poll.createdBy.name}` : ''}
            </span>
            {poll.hasVoted && canVote && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 text-xs"
                onClick={() => onRetractVote(poll.id)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Retract vote
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Poll</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{poll.question}&rdquo;? All
              votes will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(poll.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {onEmail && (
        <PollEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          teamId={poll.teamId}
          isSending={isEmailing}
          onSend={(recipients) => onEmail(poll.id, recipients)}
        />
      )}
    </>
  )
}
