import { GitMerge, Vote } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { TRetroStatus } from '@/common/enums/retro.enums'

interface PhaseAlertsProps {
  retroStatus: TRetroStatus
  userVoteCount: number
  maxVotesPerUser: number
  templateColumnCount: number
  isTemplateFetching: boolean
}

/**
 * Contextual banners for the voting and grouping phases, plus a fallback
 * warning when a retro loads without any template columns.
 */
export function PhaseAlerts({
  retroStatus,
  userVoteCount,
  maxVotesPerUser,
  templateColumnCount,
  isTemplateFetching,
}: PhaseAlertsProps) {
  return (
    <>
      {retroStatus === 'voting' && (
        <Alert className="border-primary/20 bg-primary/5 py-2.5">
          <Vote className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center gap-1.5 flex-wrap text-sm">
            <span className="font-semibold text-primary">Voting Phase</span>
            <span className="text-muted-foreground">·</span>
            <span>
              You have used{' '}
              <span className="font-bold text-primary">{userVoteCount}</span> of{' '}
              <span className="font-bold text-primary">{maxVotesPerUser}</span>{' '}
              votes
            </span>
            <span className="text-muted-foreground">·</span>
            <span>Click 👍 on cards to vote</span>
          </AlertDescription>
        </Alert>
      )}

      {retroStatus === 'grouping' && (
        <Alert className="border-primary/20 bg-primary/5">
          <GitMerge className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Grouping Phase</AlertTitle>
          <AlertDescription>
            Merge cards that describe similar topics before voting begins.
          </AlertDescription>
        </Alert>
      )}

      {templateColumnCount === 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTitle>
            {isTemplateFetching
              ? 'Loading template columns...'
              : 'Template columns unavailable'}
          </AlertTitle>
          <AlertDescription>
            {isTemplateFetching
              ? 'Preparing your board. This usually takes a moment.'
              : 'This retrospective loaded without column definitions. Please refresh, or verify the template still exists.'}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
