import { Users } from 'lucide-react'
import type { RetroDetail } from '@/common/types/retros'
import { formatTime } from '../helpers'

interface RetroLobbyViewProps {
  participants: RetroDetail['participants']
  canControl: boolean
  isLobbyTimerActive: boolean
  lobbyTimeRemaining: number | null
}

/**
 * Waiting-room view shown while a retro is in the `waiting` lobby status:
 * a gathering header, the auto-start countdown, and the participant list.
 */
export function RetroLobbyView({
  participants,
  canControl,
  isLobbyTimerActive,
  lobbyTimeRemaining,
}: RetroLobbyViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center border-2 border-amber-200 dark:border-amber-800/50">
            <Users className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold">Gathering Participants</h2>
          <p className="text-muted-foreground">
            The lobby is open! Wait for your team to join before the retro
            begins.
          </p>
        </div>

        {/* Countdown timer */}
        {isLobbyTimerActive && lobbyTimeRemaining !== null && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-6">
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
              Auto-starting in
            </p>
            <p className="text-4xl font-mono font-bold tabular-nums text-amber-800 dark:text-amber-200">
              {formatTime(lobbyTimeRemaining)}
            </p>
          </div>
        )}

        {/* Participants list */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Participants ({participants.length})
          </p>
          {participants.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5"
                >
                  {p.user?.image ? (
                    <img
                      src={p.user.image}
                      alt={p.user.name ?? 'User'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                  <span className="text-sm">
                    {p.user?.name ?? 'Participant'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No one has joined yet
            </p>
          )}
        </div>

        {/* Non-creator message */}
        {!canControl && (
          <p className="text-sm text-muted-foreground">
            Waiting for the facilitator to start the retro...
          </p>
        )}
      </div>
    </div>
  )
}
