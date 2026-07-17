import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TypingUser } from '../types'

interface ReadyBarProps {
  usesConvexRealtime: boolean
  typingUsers: Array<TypingUser>
  myReady: boolean
  readyAnimating: boolean
  onReadyAnimationEnd: () => void
  onToggleReady: () => void
}

/**
 * Active-phase action bar: a live typing indicator on the left and the
 * per-user "Ready?" toggle on the right (both Convex-only).
 */
export function ReadyBar({
  usesConvexRealtime,
  typingUsers,
  myReady,
  readyAnimating,
  onReadyAnimationEnd,
  onToggleReady,
}: ReadyBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      {/* Typing indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-5">
        {usesConvexRealtime && typingUsers.length > 0 && (
          <>
            <div className="flex gap-1">
              <span className="h-3 w-3 rounded-sm animate-ambulance-left inline-block" />
              <span className="h-3 w-3 rounded-sm animate-ambulance-right inline-block" />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].displayName} is typing…`
                : `${typingUsers.length} people are typing…`}
            </span>
          </>
        )}
      </div>

      {/* Ready button */}
      {usesConvexRealtime && (
        <Button
          variant={myReady ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'gap-1.5 h-7 text-xs transition-all',
            myReady
              ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
              : '',
            readyAnimating ? 'animate-ready-pulse' : '',
          )}
          onAnimationEnd={onReadyAnimationEnd}
          onClick={onToggleReady}
        >
          {myReady ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Circle className="h-3.5 w-3.5" />
          )}
          {myReady ? 'Ready!' : 'Ready?'}
        </Button>
      )}
    </div>
  )
}
