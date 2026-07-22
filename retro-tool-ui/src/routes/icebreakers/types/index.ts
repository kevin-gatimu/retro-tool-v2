/** The three "great answer" reactions, escalating in intensity. */
export type ReactionKind = 'celebrate' | 'applause' | 'fire'

/**
 * A single reaction row from the Convex `getRecentReactions` subscription.
 * `id` is the Convex document id — a stable unique key the client dedupes on so
 * each broadcast fires its confetti burst exactly once per viewer.
 */
export type ReactionRow = {
  id: string
  userId: string
  kind: ReactionKind
  createdAt: number
}
