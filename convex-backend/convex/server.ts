// Re-export the SCHEMA-BOUND function builders from the generated server rather
// than the schema-generic ones. Schema binding types index ranges against the
// real `DataModel`, so composite-index equality chains like
// `withIndex('by_session_user', q => q.eq('sessionId', …).eq('userId', …))`
// type-check. That matters for concurrency: reading a single row by its full
// composite key (instead of scanning a `.collect()` over an index prefix and
// filtering in JS) keeps each mutation's read-set disjoint, so concurrent
// per-user writes to the same session don't trip Convex's OCC retry.
export {
  query,
  mutation,
  internalQuery,
  // Internal functions are callable only by other Convex functions and by the
  // NestJS admin key via the HTTP /api/mutation path — never by browser
  // clients. Server-driven projection writes use these so they can't be forged.
  internalMutation,
} from './_generated/server'