import { useCallback, useEffect, useRef } from 'react'
import {
  useConvexAuth,
  useMutation as useConvexMutation,
  useQuery as useConvexQuery,
} from 'convex/react'
import { convexApi } from '@/lib/convex-api'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'
import { fireReactionBurst } from '../components/celebration-bar'
import type { ReactionKind, ReactionRow } from '../types'

const sendReactionMutationRef = convexApi.liveIcebreakers.sendReaction
const getRecentReactionsQueryRef = convexApi.liveIcebreakers.getRecentReactions

// Where a remote participant's burst launches from. The clicker sees theirs
// rise from the button they pressed; everyone else sees it rise from the
// bottom-centre of the screen (0.5, 0.85) — a neutral "somewhere in the room"
// origin, since we don't know where their button was.
const REMOTE_ORIGIN = { x: 0.5, y: 0.85 }

/**
 * Live icebreaker reactions over a direct Convex path (mirrors retro typing):
 * `send` broadcasts a reaction to every participant, and the subscription fires
 * the matching confetti burst for reactions from OTHER users. The sender skips
 * its own echo because CelebrationBar already fired their local burst from the
 * clicked button. Purely ephemeral — nothing is persisted to PostgreSQL.
 */
export function useIcebreakerReactions(sessionId: string) {
  const usesConvexRealtime = usesConvexForIcebreakers()
  const { isAuthenticated } = useConvexAuth()
  const { data: currentUser } = useCurrentUser()
  const convexReady = usesConvexRealtime && isAuthenticated

  const sendReaction = useConvexMutation(sendReactionMutationRef)

  const send = useCallback(
    (kind: ReactionKind) => {
      if (!convexReady) return
      // userId is derived server-side from the JWT; only the kind is sent.
      void sendReaction({ sessionId, kind })
    },
    [convexReady, sendReaction, sessionId],
  )

  const rawReactions = useConvexQuery(
    getRecentReactionsQueryRef,
    convexReady ? { sessionId } : 'skip',
    // Safe: getRecentReactions returns ReactionRow[] per its server schema;
    // makeFunctionReference string refs are untyped against their return.
  ) as ReactionRow[] | undefined

  // Only fire bursts for reactions that arrive AFTER this client mounts, and
  // fire each row's id exactly once. Without the mount floor a late joiner
  // would replay the last few seconds of everyone's reactions in one storm.
  const mountedAtRef = useRef<number>(Date.now())
  const firedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!rawReactions || !currentUser) return
    for (const reaction of rawReactions) {
      if (firedIdsRef.current.has(reaction.id)) continue
      firedIdsRef.current.add(reaction.id)

      // Skip rows from before mount (dedupe set is now seeded so they never
      // fire) and the sender's own echo (their local burst already played).
      if (reaction.createdAt < mountedAtRef.current) continue
      if (reaction.userId === currentUser.id) continue

      fireReactionBurst(reaction.kind, REMOTE_ORIGIN)
    }
  }, [rawReactions, currentUser])

  return { send }
}
