import { useEffect, useState } from 'react'

/**
 * Tracks the remaining seconds on a round countdown, recomputing every second
 * from the session's `timerEndsAt`. Returns `null` when no timer is active.
 */
export function useRoundTimer(timerEndsAt: Date | string | null) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!timerEndsAt) {
      setTimeRemaining(null)
      return
    }

    const endTime = new Date(timerEndsAt).getTime()

    const calculateRemaining = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeRemaining(remaining)
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)
    return () => clearInterval(interval)
  }, [timerEndsAt])

  return timeRemaining
}
