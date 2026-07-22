import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GitMerge,
  MessageSquare,
  Play,
  Trash2,
  Users,
  Vote,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus, TRetroVoteType } from '@/common/enums/retro.enums'
import {
  formatTime,
  getInitials,
  getStatusColor,
  getStatusLabel,
} from '../helpers'
import type { Mutation } from '../types'

interface RetroHeaderProps {
  retroName: string
  retroStatus: TRetroStatus
  teamDisplayName: string
  templateDisplayName: string
  isAnonymous: boolean
  voteType: TRetroVoteType
  maxVotesPerUser: number
  participants: RetroDetail['participants']
  participantCount: number
  timerDuration: number | null
  isTimerActive: boolean
  timeRemaining: number | null
  isLobbyTimerActive: boolean
  lobbyTimeRemaining: number | null
  canComplete: boolean
  canControlPhases: boolean
  usesConvexRealtime: boolean
  readyCount: number
  startLobbyMutation: Mutation
  startRetroMutation: Mutation
  moveToVotingMutation: Mutation
  moveToGroupingMutation: Mutation
  moveToDiscussionMutation: Mutation
  completeRetroMutation: Mutation
  onDeleteClick: () => void
}

/**
 * Top bar for a retro: title + status badge, settings badges (anonymity, votes,
 * participants), the phase timer / lobby countdown, phase-transition controls,
 * and the delete trigger.
 */
export function RetroHeader({
  retroName,
  retroStatus,
  teamDisplayName,
  templateDisplayName,
  isAnonymous,
  voteType,
  maxVotesPerUser,
  participants,
  participantCount,
  timerDuration,
  isTimerActive,
  timeRemaining,
  isLobbyTimerActive,
  lobbyTimeRemaining,
  canComplete,
  canControlPhases,
  usesConvexRealtime,
  readyCount,
  startLobbyMutation,
  startRetroMutation,
  moveToVotingMutation,
  moveToGroupingMutation,
  moveToDiscussionMutation,
  completeRetroMutation,
  onDeleteClick,
}: RetroHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-background via-muted/30 to-background rounded-xl p-3 sm:p-4 border border-border/50">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10 shrink-0"
        >
          <Link to="/retros" search={{ page: 1, limit: 6 }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">
              {retroName}
            </h1>
            <Badge
              variant={getStatusColor(retroStatus)}
              className="shadow-sm text-[10px] sm:text-xs shrink-0"
            >
              {getStatusLabel(retroStatus)}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {teamDisplayName} • {templateDisplayName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end sm:justify-start">
        {/* Settings badges */}
        <div className="hidden sm:flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2 sm:px-2.5 bg-background/50 text-[10px] sm:text-xs"
              >
                {isAnonymous ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                <span className="hidden lg:inline">
                  {isAnonymous ? 'Anonymous' : 'Named'}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {isAnonymous
                ? 'Card authors are hidden'
                : 'Card authors are visible'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2 sm:px-2.5 bg-background/50 text-[10px] sm:text-xs"
              >
                <Vote className="h-3 w-3" />
                <span className="hidden lg:inline">
                  {voteType === 'multi' ? `${maxVotesPerUser} votes` : '1 vote'}
                </span>
                <span className="lg:hidden">{maxVotesPerUser}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {voteType === 'multi'
                ? `Each person can vote ${maxVotesPerUser} times`
                : 'Each person can vote once'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center -space-x-2 cursor-default">
                {participants.slice(0, 5).map((p) => (
                  <Avatar
                    key={p.userId}
                    className="h-7 w-7 border-2 border-background ring-1 ring-border"
                  >
                    <AvatarImage src={p.user?.image ?? undefined} />
                    <AvatarFallback className="text-[10px] font-semibold bg-muted">
                      {getInitials(p.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {participants.length > 5 && (
                  <div className="h-7 w-7 rounded-full bg-muted border-2 border-background ring-1 ring-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                    +{participants.length - 5}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium mb-1">
                {participantCount} participant(s)
              </p>
              <ul className="text-xs space-y-0.5">
                {participants.map((p) => (
                  <li key={p.userId}>{p.user?.name ?? 'Unknown'}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Timer display */}
        {retroStatus === 'active' && timerDuration && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 border border-border/50">
            <Clock
              className={cn(
                'h-3 w-3 sm:h-4 sm:w-4',
                isTimerActive
                  ? 'text-primary animate-pulse'
                  : 'text-muted-foreground',
              )}
            />
            {isTimerActive && timeRemaining !== null ? (
              <span className="font-mono text-sm sm:text-lg font-bold tabular-nums">
                {formatTime(timeRemaining)}
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-muted-foreground">
                Timer ended
              </span>
            )}
          </div>
        )}

        {/* Lobby auto-start countdown */}
        {retroStatus === 'waiting' &&
          isLobbyTimerActive &&
          lobbyTimeRemaining !== null && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 border border-amber-200 dark:border-amber-800/50">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                Auto-starts in{' '}
                <span className="font-mono font-bold tabular-nums">
                  {formatTime(lobbyTimeRemaining)}
                </span>
              </span>
            </div>
          )}

        {/* Ready count — visible to EVERYONE in the session, not just the
            facilitator, so all participants can see how many are ready. */}
        {retroStatus === 'active' && usesConvexRealtime && (
          <Badge variant="outline" className="gap-1 text-[11px] h-7 px-2">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            {readyCount}/{participantCount} ready
          </Badge>
        )}

        {/* Phase controls */}
        {canControlPhases && (
          <div className="flex items-center gap-2">
            {retroStatus === 'draft' && (
              <>
                <Button
                  onClick={() => startLobbyMutation.mutate()}
                  disabled={startLobbyMutation.isPending}
                  className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                  size="sm"
                >
                  <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Open Lobby
                </Button>
                <Button
                  onClick={() => startRetroMutation.mutate()}
                  disabled={startRetroMutation.isPending}
                  variant="outline"
                  className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                  size="sm"
                >
                  <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Start Now
                </Button>
              </>
            )}
            {retroStatus === 'waiting' && (
              <Button
                onClick={() => startRetroMutation.mutate()}
                disabled={startRetroMutation.isPending}
                className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                size="sm"
              >
                <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Start Early
              </Button>
            )}
            {retroStatus === 'active' && (
              <Button
                onClick={() => moveToGroupingMutation.mutate()}
                disabled={moveToGroupingMutation.isPending}
                className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                size="sm"
              >
                <GitMerge className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Move to </span>Grouping
              </Button>
            )}
            {retroStatus === 'grouping' && (
              <Button
                onClick={() => moveToVotingMutation.mutate()}
                disabled={moveToVotingMutation.isPending}
                className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                size="sm"
              >
                <Vote className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Move to </span>Voting
              </Button>
            )}
            {retroStatus === 'voting' && (
              <Button
                onClick={() => moveToDiscussionMutation.mutate()}
                disabled={moveToDiscussionMutation.isPending}
                className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                size="sm"
              >
                <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Move to </span>Discuss
              </Button>
            )}
          </div>
        )}
        {/* End — completes the retro from the discussion phase. Allowed for
            creator, team-lead, org-admin, AND system admin (matches the
            server's completeRetro permission, which is broader than the
            phase-transition controls above). */}
        {canComplete && retroStatus === 'discussing' && (
          <Button
            onClick={() => completeRetroMutation.mutate()}
            disabled={completeRetroMutation.isPending}
            variant="default"
            className="shadow-sm bg-green-600 hover:bg-green-700 h-8 sm:h-9 text-xs sm:text-sm"
            size="sm"
          >
            <CheckCircle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            End
          </Button>
        )}
        {/* Delete retro — available to creators, team leads, org admins, and
            system admins (matches the server's deleteRetro permission). */}
        {canComplete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10"
            onClick={onDeleteClick}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
