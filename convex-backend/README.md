# Convex Backend

This package holds the self-hosted Convex backend used for realtime collaboration.

Initial scope:

- Active retro and estimate session projections
- Presence tracking
- Subscription-first read models for low-latency collaboration

Next setup steps:

1. Configure a local or self-hosted Convex deployment.
2. Copy `.env.example` to `.env` and set the deployment values.
3. Run `pnpm codegen` after the deployment is reachable.
4. Create a deploy/admin key for the Convex deployment and set it as `CONVEX_SYNC_ADMIN_KEY` in the NestJS API.
5. Point the NestJS API at the Convex Functions endpoint with `CONVEX_SYNC_URL`.
6. Add queries and mutations for story estimates first, then retros.
