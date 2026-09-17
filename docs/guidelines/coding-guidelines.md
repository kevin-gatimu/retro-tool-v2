# Coding Guidelines — Retro Tool

Practical dos and don'ts for this monorepo, derived from the actual code, lint configs, and
conventions on `staging`. Read alongside [CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md), and
[docs/file-naming-conventions.md](file-naming-conventions.md).

> **Golden rules:** Postgres is the system of record — the API owns all writes. Never write
> "planning poker" — the term is **"story estimate(s)"**. Run type-check + lint after every change.

---

## 1. Folder structure

### Monorepo layout (fixed — don't invent new top-level folders)

```
retro-tool/
├── convex-backend/          # Convex realtime projection layer (read-only projections)
├── packages/shared/contracts/  # Shared TS contracts (UI ↔ Convex)
├── retro-tool-api/          # NestJS 11 REST backend (Convex is the sole realtime transport)
├── retro-tool-ui/           # React 19 + TanStack Router frontend
├── infra/                   # Azure Bicep (CLI-only)
├── docker/                  # Local compose stack
└── docs/                    # Project-wide documentation
```

### API module structure (`retro-tool-api/src/<module>/`)

Every NestJS module follows this exact shape:

```
module-name/
├── module-name.module.ts
├── module-name.controller.ts        # + .controller.spec.ts
├── module-name.service.ts           # + .service.spec.ts
├── module-name.gateway.ts           # only if WebSocket events
├── dto/                             # Zod schema + inferred type + Swagger class per file, barrel index.ts
├── types/index.ts                   # ALL module-specific types live here
├── schema/index.ts                  # Drizzle table definitions
├── queries/                         # (optional) complex SQL aggregation helpers
└── guards/                          # only if module-specific guards
```

**Do**
- Put every module-specific type in `types/index.ts`. Shared types go in `common/types`.
- Put cross-module guards, pipes, interceptors, and enums in `common/`.
- Keep one DTO per file under `dto/`, re-exported from `dto/index.ts`.

**Don't**
- Don't create loose `*.types.ts` files — the lint config **errors** on `type`/`interface`
  declarations inside `*.service.ts` (only the `Database` alias is allowed).
- Don't put business logic outside services (not in controllers, not in gateways, and **never**
  in Convex mutations).
- Don't add tables to a central schema file — each module owns its own `schema/index.ts`;
  migrations live in `retro-tool-api/drizzle/`.

### UI structure (`retro-tool-ui/src/`)

```
src/
├── routes/          # TanStack Router file-based routes (URL = file name)
├── components/      # Shared components; components/ui/ = shadcn primitives (don't hand-edit style)
├── hooks/           # Shared hooks (use-*.ts)
├── lib/             # Non-React utilities (api.ts, socket.ts, auth-client.ts, …)
├── common/          # enums/, helpers/, types/
└── integrations/    # Provider wiring (better-auth, tanstack-query)
```

**Do**
- Colocate route-specific components/hooks under the route folder
  (`routes/admin/hooks/use-user-search.ts`).
- Promote to `components/` or `hooks/` only once used by ≥2 routes.

**Don't**
- Don't put fetch logic or Axios calls inline in components — wrap them in hooks/`lib`.
- Don't modify `components/ui/` shadcn primitives beyond what the shadcn pattern intends;
  compose them instead.

---

## 2. File & folder naming

Full reference: [docs/file-naming-conventions.md](file-naming-conventions.md). Summary:

| Kind | File name | Export |
| --- | --- | --- |
| React component | `notification-bell.tsx` | `export function NotificationBell()` |
| Hook | `use-current-user.ts` | `export function useCurrentUser()` |
| Utility | `api-endpoints.ts` | `export const USERS_ENDPOINTS` |
| Types | `types/index.ts` | type declarations |
| Skeleton | `skeleton/index.tsx` (group) / `reports.skeleton.tsx` (single) | `export function XSkeleton()` |
| API files | `teams.controller.ts`, `teams.service.ts`, `create-team.dto.ts` | NestJS idioms |

**Do**
- Use `kebab-case` for every UI source file; keep exports idiomatic (`PascalCase` components,
  `useCamelCase` hooks, `SCREAMING_SNAKE` consts). **File name ≠ export name.**
- Keep the `use-` prefix on both hook file and export — tooling depends on it.
- For case-only renames, go through a temp name so git records it:
  `git mv Foo.tsx foo.tmp && git mv foo.tmp foo.tsx`.

**Don't**
- Don't rename TanStack Router route files (`index.tsx`, `$teamId.tsx`, `__root.tsx`) — the
  router owns those names.
- Don't use `PascalCase.tsx`, `camelCase.ts`, or `snake_case.ts` file names anywhere in the UI.

---

## 3. TypeScript practices (strong typing)

**Do**
- Treat the UI's `strict: true` as the baseline everywhere. The API currently has
  `noImplicitAny: false` and `no-explicit-any` off — **write new API code as if both were on**;
  the goal is to tighten these flags over time, and new `any`s move us backwards.
- Use `import type { Foo }` for type-only imports (UI has `verbatimModuleSyntax`; the
  `consistent-type-imports` rule rejects inline `import()` types in generics — import at the top
  and reference directly).
- Derive types instead of duplicating them:
  - DTOs: `export type CreateTeamDto = z.infer<typeof createTeamSchema>;`
  - DB rows: `typeof teams.$inferSelect` / `$inferInsert` from Drizzle schemas.
- Model closed sets as `const` objects + derived unions (the `common/enums` pattern:
  `TEAM_MEMBER_TAGS` + `TTeamMemberTag`), not TS `enum`.
- Type every exported function's parameters and return where inference isn't obvious; let
  inference work for locals.
- Use discriminated unions for multi-state data (`{ status: 'loading' } | { status: 'error'; error: E } | …`)
  instead of parallel nullable fields.
- Handle `null`/`undefined` explicitly — narrow with early returns; prefer `??` over `||` when
  `0`/`''` are valid values.
- Use `satisfies` for config/lookup objects: it validates the shape **without widening** the
  inferred literal types (`const routes = {...} satisfies Record<string, Route>`), unlike a type
  annotation (widens) or `as` (bypasses checks). Ideal for chart configs, query-key factories,
  route maps, theme objects.
- Prefer `interface` for object shapes you expect to extend; `type` for unions, intersections,
  and derived/mapped types. Be consistent within a module.
- Use `readonly` on properties and `ReadonlyArray<T>`/`readonly T[]` for data that must not be
  mutated after creation (projection snapshots, config).
- Use template literal types for string patterns (`` type QueryKey = `team-${string}` ``) and
  `const` type parameters / `as const` to preserve literals where unions are derived from data.
- Prefer exhaustive `switch` over unions with a `never` check in `default`
  (`const _exhaustive: never = value`) so adding a variant fails compilation, not production.
- Parse, don't validate twice: at trust boundaries (HTTP bodies, socket payloads, `JSON.parse`,
  external APIs), run input through a Zod schema once and pass the **inferred type** downstream —
  after that, no defensive re-checking.

**Don't**
- Don't use `any` — use `unknown` at trust boundaries and narrow with Zod or type guards.
- Don't use `as` casts to silence errors; a cast is a claim you must be able to defend in review.
  Never `as unknown as X`.
- Don't use non-null assertions (`!`) except where a framework guarantees presence — prefer a
  runtime check that throws a clear error.
- Don't export types from service files, or declare them there (lint enforces this in the API).
- Don't duplicate a shared contract — UI ↔ Convex shapes belong in `packages/shared/contracts`.

---

## 4. Readable code (no complex or shortcut code)

**Do**
- Write for the next reader: descriptive names (`carriedForwardActionItems`, not `cfa`), one
  purpose per function, early returns over nesting.
- Keep functions small enough to read without scrolling (~40 lines is a smell threshold) and
  files focused (~300 lines for components; split before you hit it — the 1,650-line
  `routes/reports.tsx` is the counter-example being redesigned).
- Comment **why**, not what — e.g. the tsconfig comment explaining why `declaration: false`.
- Name magic values: `const JWT_TTL_MINUTES = 15`, not a bare `15`.
- Let Prettier + ESLint decide formatting; fix warnings, don't accumulate them
  (`no-floating-promises` warnings in the API are still bugs — `await` or `void` explicitly).

**Don't**
- Don't write clever one-liners: no nested ternaries, no dense `reduce` chains where a `for..of`
  or a couple of `map`/`filter` steps read better, no `!!x` where `Boolean(x)` or a comparison is
  clearer.
- Don't abbreviate names except idiomatic ones (`id`, `dto`, `url`).
- Don't leave commented-out code, dead exports, or `// eslint-disable` without a reason on the
  same line. **Never** add `// eslint-disable-next-line react-hooks/exhaustive-deps` — that rule
  isn't in the config; remove such comments on sight.
- Don't mix refactors with behavior changes in one commit.

---

## 5. React best practices (incl. code splitting)

### Components & state

**Do**
- Write function components; keep them presentational and lift data-fetching into hooks.
- Extract a custom hook the moment a component juggles ≥2 related `useState`/`useEffect` pairs
  (see `use-poll-mutations.ts`, `use-session-view-preferences.ts` for the pattern).
- Use TanStack Query for all server state: query key factories per domain, mutations with
  targeted `invalidateQueries`, `staleTime` tuned per data class. Server state lives in Query,
  not in `useState`.
- Use TanStack Form for forms and Zod for client-side validation, mirroring API schemas.
- Gate realtime subscriptions on `isAuthenticated` (Convex) and keep the per-feature
  `VITE_*_REALTIME_BACKEND` env switch behind `lib/realtime-config.ts` — components shouldn't
  hardcode the backend. (Convex is the only implemented backend today; Socket.IO gateways were
  removed, so the flag's `socket-io` value has no live code path.)

**Don't**
- Don't fetch in `useEffect` — that's what Query is for.
- Don't store derived data in state; compute it in render (memoize only when measured as hot).
- Don't pass 6+ props through layers — restructure with composition (`children`) or context.
- Don't create components inside other components' render bodies.

### React 19 features & performance

**Do**
- Use `useTransition` for expensive state updates you own (filtering big tables, recomputing
  charts) and `useDeferredValue` when the expensive value comes from props/external stores —
  keeps typing and clicking responsive.
- Use `useActionState` for form submissions: it replaces the hand-wired
  `onSubmit` + `isLoading` + `error` triple with one hook.
- Use the `use()` hook to read context (and promises under `<Suspense>`) instead of extra
  `useEffect`/`useState` plumbing where it simplifies code.
- Profile before memoizing: use React DevTools Profiler to find actually-hot re-renders, then
  apply `memo`/`useMemo`/`useCallback` selectively. (If/when the React Compiler is enabled in the
  Vite build, most manual memoization becomes unnecessary — remove rather than add.)
- Keep list keys stable and derived from data ids, never array indexes for mutable lists.

**Don't**
- Don't wrap every component in `React.memo` or every function in `useCallback` "just in case" —
  unmeasured memoization is noise that hides the real hot spots.
- Don't block urgent input handling with synchronous heavy computation — move it behind a
  transition or a web worker.
- Don't subscribe a high-level component to fast-changing state that only a leaf needs (e.g.
  socket/Convex tick data in a route component) — push subscriptions down to the consumer.

### Code splitting

**Do**
- Rely on route-based splitting first: TanStack Router file routes are the natural chunk
  boundary — keep heavy features in their own route files.
- `React.lazy` + `<Suspense>` for heavy below-the-fold or conditional subtrees — charts
  especially. The reports redesign mandates a lazily-loaded chart chunk so Recharts stays out of
  the main bundle; follow that pattern for any large dependency (editors, players, exports).
- Pair every lazy boundary with a real skeleton (`skeleton/index.tsx` or `<name>.skeleton.tsx`)
  matching the loaded layout — no spinner-only fallbacks for full views.
- Check the effect with `pnpm --filter retro-tool-ui build` bundle output when adding a heavy dep.

**Don't**
- Don't import a heavy library at the top of a shared module (`lib/`, `__root.tsx`,
  `components/` barrels) — that defeats all downstream splitting.
- Don't lazy-load tiny components; the request overhead outweighs the bytes.
- Don't create barrel files that re-export entire feature trees — they make bundlers pull
  everything in and invite `import/no-cycle` problems.

---

## 6. NestJS best practices

### Controllers, services, DTOs

**Do**
- Follow the `teams` module as the reference implementation:
  - Controller: routing + Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`,
    `@ApiBearerAuth('session')`) + validation pipes only.
  - Service: all business logic and DB access.
  - DTO file: Zod schema + `z.infer` type + a parallel `*DtoClass` with `@ApiProperty` for
    Swagger docs.
- Validate every body/query with `ZodValidationPipe` (`@UsePipes(new ZodValidationPipe(schema))`)
  and constrain fields (`.min()`, `.max()`, `.enum()`) — unconstrained `z.string()` is a smell.
- Keep the global `AuthGuard` fail-closed posture: new routes are authenticated by default;
  `@AllowAnonymous` requires a justifying comment and a security-review eye.
- **Authorize, don't just authenticate**: every service method taking an org/team/retro/session
  ID must verify the caller's membership/role before touching data (see SECURITY-ASSESSMENT.md
  F1/F2 — IDOR via unscoped IDs is our top standing risk). Prefer reusable guards over inline
  checks when the rule is per-route.
- Use Drizzle query builders; the rare ``sql`` `` template may interpolate only columns and
  constants — never request data.
- Inject config via `ConfigService`; never read `process.env` in feature code.
- After each mutation that affects a live view, push the projection to Convex from the service
  (the sync layer) — Convex functions themselves stay logic-free, and server-driven writes are
  `internalMutation` only.

**Don't**
- Don't put permission checks only in the controller comment ("enforced in service") without the
  service actually enforcing it — verify both halves exist.
- Don't return Drizzle rows raw when they contain fields the caller's role shouldn't see —
  shape responses per role server-side.
- Don't `await` nothing: floating promises are warnings today, incidents later.
- Don't add WebSocket event handlers without per-event authorization — handshake auth only
  proves identity, not membership (gateways must re-check like their REST equivalents).
- Don't write migrations by hand — `pnpm --dir retro-tool-api db:generate` from schema changes.

### Dependency injection & module boundaries

**Do**
- Use constructor injection exclusively (`constructor(private readonly teamsService: TeamsService)`);
  register non-class dependencies with `useFactory`/`useValue` custom providers (the
  `DATABASE_CONNECTION` pattern).
- Keep each domain feature its own `@Module()`; export from the module **only** what other
  modules consume — everything else stays private.
- Respect the request pipeline when choosing where logic lives:
  Middleware → Guards → Interceptors (before) → Pipes → Handler → Interceptors (after) →
  Exception Filters. Auth = guards, validation = pipes, response shaping = interceptors,
  error mapping = filters — not ad-hoc code in handlers.
- Follow single-responsibility: when a service crosses ~500 lines or juggles several concerns,
  split it into focused providers within the module (e.g. `<module>.sync.service.ts` for Convex
  projection pushes, a `queries/` layer for aggregation).

**Don't**
- Don't use `forwardRef()` to paper over circular dependencies — restructure (usually by moving
  the shared piece into `common/` or a third module).
- Don't inject the DB connection into gateways/controllers — data access belongs to services.

### Error handling

**Do**
- Throw NestJS HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`…)
  from services with actionable messages; let the global exception filter shape the response.
- Return 404 (not 403) when hiding a resource's existence from a non-member is the safer leak
  posture — pick per endpoint and be consistent.
- Wrap external calls (Resend, Convex sync, web-push) in try/catch that logs with context and
  degrades gracefully — a failed projection push must never fail the user's write; use the
  reconciliation cron as the safety net.
- Use the Nest `Logger` with a per-class context (`new Logger(TeamsService.name)`) — no bare
  `console.log` in the API.

**Don't**
- Don't swallow errors (`catch {}`) or rethrow raw DB errors to clients — map them to HTTP
  exceptions so internals (SQL, constraint names) never leak.
- Don't encode errors as `{ success: false }` payloads with HTTP 200 — use status codes.

### Testing

**Do**
- Ship `*.spec.ts` beside controller and service (Jest); UI logic/hooks get Vitest tests.
- Test service authorization paths (the "wrong org member gets 403" case) — they're the tests
  that catch real vulnerabilities.

**Don't**
- Don't mock so much the test only proves the mock; test observable behavior.

---

## 7. Mandatory checks (every change)

```bash
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui  type-check
pnpm --filter retro-tool-api lint
pnpm --filter retro-tool-ui  lint
```

Pre-commit hooks run lint-staged (ESLint + Prettier) and block on failure. CI re-runs lint,
type-check, and tests on every PR.

Editing anything in `convex-backend/convex/`? Read
`convex-backend/convex/_generated/ai/guidelines.md` first — it overrides general Convex
knowledge.

---

## 8. Package scripts (`package.json`)

**Do**
- Keep script names consistent across packages — same verb, same behavior: `dev`, `build`,
  `test`, `lint` (check-only), `lint:fix`, `format` (check-only), `format:fix`, `type-check`.
  A given name must do the same thing in every package.
- Make `lint` and `format` **read-only** so CI can run them as gates; mutation belongs in
  explicit `:fix` variants and in lint-staged.
- Keep root scripts thin delegators (`pnpm -r --filter … <script>`); logic lives in the package
  that owns it.
- When a root script references a package script, treat the pair as an API contract — renaming a
  package script means updating the root script, CLAUDE.md/AGENTS.md, and CI in the same commit.
- Extract repeated multi-command chains (build + env-load + run across environments) into a small
  parameterized runner under `scripts/` (e.g. `node scripts/db.mjs seed:templates staging`)
  instead of copy-pasting near-identical one-liners per environment.
- Real packages need real `build`/`lint`/`type-check` — a stub that `console.log`s success makes
  every aggregate green a lie. If a package can't implement a script yet, exclude it from the
  root filter rather than stubbing it.
- Pin `packageManager` to a **stable** release, and keep the `engines` field in sync with the
  documented Node version.

**Don't**
- Don't run `eslint --fix` / `prettier --write` as the default `lint`/`format` — CI must never
  mutate code, and a "passing" auto-fixed lint hides violations locally.
- Don't let environment variants drift: if `db:seed` gains a step, its `:staging`/`:prod`
  variants must gain it too (another reason to centralize in a runner script).
- Don't duplicate tool configs per package when one root config works (commitlint, prettier) —
  duplicated configs drift silently.

---

## 9. Versioning & releases

The product deploys as one unit (UI + API + Convex from the same branch), so use **lockstep
semantic versioning**: a single `MAJOR.MINOR.PATCH` version for the whole repo, tagged `vX.Y.Z`.

- **MAJOR** — breaking change for users or operators (auth changes requiring re-login, removed
  endpoints, migration requiring downtime).
- **MINOR** — new feature (a new report dashboard, a new template type).
- **PATCH** — bug fix, dependency bump, docs.

**Process (recommended): [release-please](https://github.com/googleapis/release-please)** — fits
because conventional commits + commitlint are already enforced by the commit-msg hook:

1. Commits to `main` use conventional types; `feat:` bumps minor, `fix:` bumps patch,
   `feat!:`/`BREAKING CHANGE:` bumps major.
2. The release-please GitHub Action maintains an open "release PR" that accumulates the
   changelog; merging it bumps every `package.json` version (linked/lockstep mode), updates
   `CHANGELOG.md`, tags `vX.Y.Z`, and creates the GitHub Release.
3. `deploy-api` tags the Docker image with the release version (`acr.io/retro-tool-api:v1.1.0`)
   in addition to the SHA, so prod rollbacks are `v1.1.0 → v1.0.3`, not SHA archaeology.
4. Surface the version at runtime: inject `VITE_APP_VERSION` at UI build, expose it in the API's
   health endpoint and Swagger `.setVersion()` — so "what's deployed?" has a one-glance answer.

Alternative: [Changesets](https://github.com/changesets/changesets) decouples version bumps from
commit messages via `.changeset/*.md` files and has the best independent-versioning story — the
better pick **if** packages ever need separate versions (e.g. publishing `@retro-tool/contracts`).
For a single deployed product, release-please is less ceremony.

**Do**
- Write commit types honestly — automated versioning is only as truthful as the `feat:`/`fix:`
  prefixes it reads.
- Keep commitlint strict enough to guarantee parseable history: `type-empty` and `subject-empty`
  must **error**, header length sane (~100), and no `wip` commits on `main`/`staging`
  (squash-merge PRs so `wip` never reaches release branches).

**Don't**
- Don't hand-edit `version` fields or create tags manually once automation owns them.
- Don't reuse or move a published tag — a released version is immutable; fix forward with a patch.

---

## Sources

Project-internal: [CLAUDE.md](../../CLAUDE.md), [docs/file-naming-conventions.md](file-naming-conventions.md),
`retro-tool-ui/eslint.config.js`, `retro-tool-api/eslint.config.mjs`, both `tsconfig.json` files,
and the `teams` module as reference implementation.

External references consulted (July 2026):

- [React 19 in Mid-2026: Trends, Patterns & Migration Order](https://techglock.com/blog/react-19-in-mid-2026-what-we-ship-what-we-removed-what-we-watch)
- [React Stack Patterns — patterns.dev](https://www.patterns.dev/react/react-2026/)
- [Code Splitting and Lazy Loading in React](https://oneuptime.com/blog/post/2026-01-15-react-code-splitting-lazy-loading/view)
- [React 19 Best Practices](https://dev.to/jay_sarvaiya_reactjs/react-19-best-practices-write-clean-modern-and-efficient-react-code-1beb)
- [Best Practices for Structuring a NestJS Application](https://arnab-k.medium.com/best-practices-for-structuring-a-nestjs-application-b3f627548220)
- [NestJS Architecture & Dependency Injection](https://medium.com/@kashafabdullah01/nestjs-architecture-dependency-injection-22a506296f75)
- [NestJS best-practices rule set](https://explainx.ai/skills/giuseppe-trisciuoglio/developer-kit/nestjs-best-practices)
- [TypeScript Do's and Don'ts (official handbook)](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [TypeScript Best Practices 2026](https://hashtagcoders.lk/blogs/typescript-best-practices-2026)
- [Why prefer `unknown` over `any`](https://dev.to/56_kode/clean-code-why-prefer-unknown-over-any-in-typescript-50mc)
- [The `satisfies` operator in real projects](https://dev.to/gavincettolo/typescript-tips-that-actually-matter-in-real-projects-including-the-satisfies-operator-2cfg)
