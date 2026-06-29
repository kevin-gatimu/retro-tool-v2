import {
  mutationGeneric,
  queryGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from 'convex/server'

export const mutation = mutationGeneric
export const query = queryGeneric

// Internal functions are callable only by other Convex functions and by the
// NestJS admin key via the HTTP /api/mutation path — never by browser clients.
// Server-driven projection writes use these so they can't be forged from the UI.
export const internalMutation = internalMutationGeneric
export const internalQuery = internalQueryGeneric