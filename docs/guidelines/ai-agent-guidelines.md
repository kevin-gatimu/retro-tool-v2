# AI agent guidelines

Use this workflow for any AI-assisted change to Retro Tool. It is vendor-neutral and supplements the repository's coding guidelines.

## 1. Establish context before editing

1. Read the root `AGENTS.md`, then any nearer `AGENTS.md` in the directory being changed.
2. Read `docs/guidelines/coding-guidelines.md` and the domain documentation linked from `docs/README.md`.
3. Inspect the implementation, tests, package scripts, and recent call sites. Code is the source of truth when documentation has drifted; update related documentation in the same change.
4. Run `pnpm dlx @tanstack/intent@latest list` from the workspace root. Load a matching local skill before making a substantial change.
5. Check `git status` and avoid overwriting unrelated or user-authored work.

Keep the change narrow. Do not perform unrelated cleanup, dependency upgrades, migrations, or formatting.

## 2. Preserve architecture invariants

- PostgreSQL, accessed through the NestJS API, is the authoritative store for durable business data.
- Convex is a realtime projection layer. Browser clients read projections; only API projection services write them. Do not move business rules or authoritative writes into Convex.
- Mutations must enforce authorization in the API with the established context builders, permission helpers, and `assertPermission`. UI visibility checks are usability controls, not security boundaries.
- Keep shared UI/Convex contracts in `packages/shared/contracts`. Do not create divergent local copies.
- Use **story estimate** or **story estimates**; never use “planning poker.”

Before editing `convex-backend/convex/`, read `convex-backend/convex/_generated/ai/guidelines.md`.

## 3. Design for failure and partial success

### Projection and reconciliation work

- Treat projection delivery as retryable and idempotent.
- Bound concurrency when sending batches to the self-hosted Convex worker.
- Do not prune stale rows if any rebuild, page, or mutation in that reconciliation scope failed. A partial mark phase must never be followed by destructive sweep.
- Propagate failures to orchestration and CI; do not convert failed work into a successful summary.
- Prefer the transactional outbox's retry, backoff, and failure-reporting patterns over duplicated one-off HTTP clients.
- Use indexed point lookups in Convex and keep mutation work below platform execution limits.

### API side effects

- Await required side effects.
- For best-effort email, notification, or projection work, log failures with enough identifiers to diagnose them and expose a metric or durable retry path where appropriate. Never use an empty catch that hides operational failure.

### Bulk operations

- Prefer one transactional bulk API endpoint when the user expects all-or-nothing behavior.
- If partial success is intentional, return per-item results, use bounded concurrency, invalidate affected caches on both success and failure, and show an accurate result to the user.

## 4. Follow package conventions

### NestJS API

- Keep module-specific types in `types/index.ts`, DTOs in `dto/`, and Drizzle definitions in `schema/index.ts`.
- Use injected services and existing modules rather than constructing dependencies directly.
- Add or update tests for permission branches, validation, failures, and successful mutations.
- Generate migrations with the existing Drizzle scripts; do not hand-edit migration history unless the repository workflow explicitly requires it.

### React UI

- Use kebab-case source file names; preserve TanStack Router's route-file naming.
- Use TanStack Query for server state and the existing RBAC helpers for conditional UI.
- Update or invalidate every affected query after mutations, including partial-failure paths.
- Treat realtime data as a projection: REST mutations still go through NestJS, and components must tolerate projection lag or temporary unavailability.
- Do not infer browser privacy mode from storage errors. Storage availability and persistence behavior vary by browser.
- Do not expose secrets through `VITE_*` variables or committed environment files.

### Convex

- Keep mutations deterministic, idempotent, narrowly scoped, and free of authoritative business decisions.
- Use declared indexes instead of table scans.
- Update contracts and tests when projection shapes or authorization filters change.
- Never edit generated files directly.

## 5. Validate proportionately

Run the smallest relevant test first, then the mandatory repository checks after code changes:

```bash
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui type-check
pnpm --filter retro-tool-api lint
pnpm --filter retro-tool-ui lint
```

Also run affected package tests. Run workspace-wide checks when shared contracts, build configuration, dependencies, or cross-package behavior changes. For documentation-only changes, verify links and run:

```bash
git diff --check
```

Do not add a new tool solely to validate a change when the repository already provides one.

## 6. Keep automation reproducible

- Treat the root `package.json` `packageManager` field as the pnpm version source of truth. GitHub Actions must not declare a conflicting version.
- Put pnpm workspace overrides in `pnpm-workspace.yaml` and use bounded ranges to avoid accidental major-version upgrades.
- Do not bypass hooks, force-push, commit secrets, or modify generated lockfiles manually.
- Document new environment variables in the relevant `.env.example` and operational documentation without including real values.

## 7. Completion checklist

Before reporting completion:

- Review the final diff for unrelated edits and generated artifacts.
- Confirm the requested behavior and important failure paths are tested.
- Confirm authorization and trust boundaries remain intact.
- Update directly affected documentation and examples.
- Report validation commands and outcomes accurately; never claim a check was run when it was not.
- Leave the working tree in a clear state and do not commit or push unless requested.
