import { Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ICEBREAKER_SESSION_STATUSES } from '@/common/enums/icebreaker.enums'
import { STATUS_LABELS } from '@/routes/icebreakers/helpers'
import type { IcebreakerEntrySession } from '@/common/types/icebreakers'

interface IcebreakerSessionCardProps {
  session: IcebreakerEntrySession
  /** Open the session — the standup room runs it in an in-page modal. */
  onOpen: (sessionId: string) => void
}

/**
 * Compact icebreaker card shown in the standup feed. The full swipe/present
 * runtime opens in place via `onOpen`, so the host never leaves the standup.
 */
export function IcebreakerSessionCard({
  session,
  onOpen,
}: IcebreakerSessionCardProps) {
  const openLabel =
    session.status === ICEBREAKER_SESSION_STATUSES.Completed
      ? 'View recap'
      : 'Open'

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Icebreaker
            </div>
            <p className="truncate font-semibold">{session.name}</p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {STATUS_LABELS[session.status]}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              {session.keptCount}/{session.promptCount} kept
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {session.participantCount}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onOpen(session.id)}
          >
            {openLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
