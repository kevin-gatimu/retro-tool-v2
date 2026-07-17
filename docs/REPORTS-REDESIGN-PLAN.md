# Reports Feature Redesign — Implementation Plan

> Status: **FULLY IMPLEMENTED (Phases 0–6, 2026-07-16)** on `chore/guidelines-compliance` (uncommitted).
> Shipped: reports v2 API (`/reports/v2/*` — composite payloads per §6 **plus** the three paginated
> league endpoints with SQL `LIMIT/OFFSET` + `ILIKE` search), `retroParticipant`-based attendance,
> lead-only response shaping, tail metrics (standup submission rate, personal completion trend, org
> cadence heat); full `routes/reports/` UI with URL-synced ranges (`validateSearch`), route loaders +
> `useSuspenseQuery`, paginated/searchable league tables, jsPDF + CSV exports, cadence heat grid;
> §6.3 supporting indexes added to the Drizzle schemas (**run `pnpm --dir retro-tool-api db:generate`
> then `db:migrate` locally**); Phase 6 cleanup done — legacy v1 controller/service/schema deleted,
> Convex `liveReports.ts` + all 7 aggregate components retired (usage audit found zero consumers),
> `docs/RBAC.md` updated; §10 tests added (DTO/resolveRange, bucketing/gap-fill, all three guards,
> controller response-shaping — Jest; league table/stat card/search schema — Vitest).
> Remaining niceties (non-blocking): DB-backed metric-correctness fixtures (§10) and the §6.4
> Phase-2 cache, both gated on staging measurements.
> Scope: redo the reports feature so every role gets purpose-built insight:
> `super-admin` / `system-admin` (platform), `org-owner` / `org-admin` (organization),
> `team-lead` (team health), `member` (personal + own-team).
> Terminology: this document and all resulting code use **"story estimate(s)"**.

---

## 1. Current-State Assessment

### 1.1 What exists today

**API — `retro-tool-api/src/reports/`**

| File | Notes |
|---|---|
| `reports.controller.ts` | 8 endpoints under `/reports`: `GET /me`, `teams/:teamId/{metrics,health,action-items,estimate-kpis}`, `organizations/:orgId/{templates,overview}`, `GET /system` |
| `reports.service.ts` | ~1,170 lines; all aggregation, plus inline access checks (`assertTeamMember`, `assertOrgMember`, `assertOrgAdmin`, `assertSystemAdmin`) |
| `reports.module.ts`, `*.spec.ts` | Module + Jest specs for controller/service |
| `schema/index.ts` | **No DB tables** — only return-type interfaces (`TeamMetrics`, `HealthScore`, `ActionItemAnalytics`, `TemplateUsageMetrics`, `UserStats`, `EstimateKPIs`, `OrgOverview`, `SystemOverview`) |

Current capabilities: team retro metrics (retro count, participation, cards, votes), a 0–100 team health score (participation 30 / engagement 25 / completion 25 / frequency 20, with quarter-based trend), action-item analytics (completed/pending/overdue, top assignees), story estimate KPIs (sessions completed, stories estimated, voter participation, avg votes/story), template usage, org overview with paginated team breakdown, system overview with paginated org breakdown.

**Convex — `convex-backend/convex/liveReports.ts`**

`@convex-dev/aggregate` counters written by NestJS after each mutation:
`retrosCompletedByTeam`, `cardsByTeamUser`, `votesByTeamUser`, `actionItemsByTeamStatus`, `estimateSessionsByTeam`, `systemRetros`, `systemUsers`. Read queries: `getTeamStats`, `getUserStats` (caller-scoped), `getSystemStats` (admin-gated).

**UI — `retro-tool-ui/src/routes/reports.tsx` (+ `reports.skeleton.tsx`)**

One ~1,650-line route file with four tabs (My Stats / Teams / Organization / System), inline response types, `StatCard`/`ColorBar` primitives, a single lazy-loaded Recharts pie chart (`components/action-items-pie-chart.tsx` — Recharts `^3.8.0` is already a dependency), tables with server-side pagination, and print-window "Export PDF". Role gating is client-side derivation from `useCurrentUser()` + org list.

### 1.2 Gaps and problems

| # | Gap | Detail |
|---|---|---|
| G1 | **Convention violations** | Report types live in `schema/index.ts`, not `types/index.ts`; no `dto/` folder (query params parsed ad hoc); auth checks are inline service methods instead of guards. |
| G2 | **No trends / time series** | Everything is a point-in-time scalar for one period. No week-over-week series, no sparklines, no comparisons — the main thing charts are for. |
| G3 | **Inefficient aggregation** | Service pulls row IDs into Node and counts in JS (`select id ... .length`), N+1 template loops, in-memory pagination/search of breakdowns. Should be SQL `GROUP BY` / window functions. |
| G4 | **Role dashboards are shallow** | One page, four tabs; member and team-lead see the same team tab; org/system tabs are stat cards + one table. No team-lead-specific health drilldown, no org growth, no platform usage. |
| G5 | **Unused data** | Not surfaced anywhere: `retroParticipant` (true attendance vs. card-author proxy), `card.isDiscussed`/`discussedAt`, template columns (sentiment by category), `actionItem.isCarriedForward`, `actionItem.dueDate` aging, story estimate round `agreedPoints` + vote `points` (consensus/spread/velocity), standups, surveys, polls, icebreakers, `user.createdAt`/`status` (growth funnels), auth `session` (active-user counts). |
| G6 | **`participationRate` is wrong-ish** | Uses unique card authors ÷ team size; anonymous retros and non-writing attendees skew it. `retroParticipant` is the correct source. |
| G7 | **Convex layer half-used** | Reports page never subscribes to `liveReports` queries — the aggregates duplicate what Postgres answers, adding write-path cost for little value. |
| G8 | **Team-lead RBAC drift** | `docs/RBAC.md`: team authority is `teamMember.tag = 'team-lead'` (the `user.role` value is legacy). Reports service never distinguishes lead vs. member — per-member drilldowns would leak to plain members if added naively. |
| G9 | **Exports** | Print-window HTML injection PDF export is fragile; charts won't render in it. |
| G10 | **UI monolith** | Inline types duplicated from API, no colocated hooks, one giant route file — against `docs/file-naming-conventions.md` spirit. |

---

## 2. Goals & Design Principles

1. **Insight per role, not one page for all** — each role lands on a dashboard scoped to what they govern.
2. **PostgreSQL is the system of record** — all report aggregation is SQL in the API. Convex is only for *live in-session* views (per CLAUDE.md key architectural rule).
3. **Time series first** — every KPI gets a trend, bucketed server-side (`day|week|month`).
4. **Follow module/file conventions** — `types/index.ts`, `dto/`, guards; kebab-case UI files.
5. **Cheap to render** — shadcn-style chart components on the existing Recharts dependency; lazy-loaded chart chunks.
6. **RBAC enforced server-side** — client only decides what to *show*, never what is *allowed*.

---

## 3. Per-Role Insight Matrix

Scoping rules (from `docs/RBAC.md`): system roles from `user.role`; org roles from `organizationMember.role`; team lead from `teamMember.tag === 'team-lead'`. `isTeamLead(ctx)` is true for system-admin+ and org admin+ as well (cascade).

| Role | Scope | Dashboard | Key insights |
|---|---|---|---|
| **super-admin / system-admin** | Platform-wide | **Platform dashboard** | Org/team/user growth curves; active users (7d/30d via auth `session`); retros & story estimate sessions per week; feature adoption (retros, story estimates, standups, surveys, polls, icebreakers); most/least active orgs; pending-approval user funnel |
| **org-owner / org-admin** | Their org(s) | **Organization dashboard** | Org membership growth; retro cadence per team; cross-team participation heat; action-item completion league; template usage; story estimate throughput per team; teams at risk (health < threshold) |
| **team-lead** | Their team(s) | **Team health dashboard** (full) | Health score + component trend; true attendance (`retroParticipant`); card volume by template column (sentiment mix); vote concentration; discussion coverage (`isDiscussed`); action items: completion, overdue aging, carry-forward rate, per-assignee load; story estimates: consensus rate, vote spread, points-agreed velocity, re-vote rounds |
| **member** | Self + own team(s) | **My insights** + read-only team view | Personal contributions trend (cards, votes, comments); retros attended; my action items (open/overdue/completed); my story estimate participation and agreement-with-consensus; team summary **without** per-member breakdowns |

Member vs. team-lead on the same team view: members see aggregate team metrics only; per-member tables (top assignees, per-user participation, member filter) require team-lead (or higher) — enforced server-side (fixes G8).

---

## 4. Chart Library — Research & Recommendation

### 4.1 Recommendation: **shadcn/ui chart pattern on Recharts v3** (already installed)

Justification:

- **Zero new dependency**: `recharts ^3.8.0` is already in `retro-tool-ui/package.json` and used by `action-items-pie-chart.tsx`. The shadcn chart component is a copy-paste wrapper (ChartContainer/ChartTooltip/ChartLegend + CSS-variable theming), not a package — it matches the project's existing shadcn/ui + Radix pattern exactly.
- **React 19 + Tailwind 4**: shadcn/ui components (charts included) are updated for Tailwind v4 and React 19; Recharts v3 is the version shadcn charts target.
- **Theming**: chart colors flow through CSS variables (`--chart-1…5` in the Tailwind theme), so dark mode and the existing design tokens work for free — no per-chart palette plumbing like today's `chartPalette` object.
- **Accessibility**: Recharts' `accessibilityLayer` prop (surfaced by shadcn charts) adds keyboard navigation and screen-reader support per chart.
- **Ecosystem/maintenance (mid-2026)**: Recharts remains the most-adopted React chart library and the "safest default" for React dashboards, with the cleanest fit for shadcn/ui stacks.
- **Data scale fits SVG**: dashboards render dozens-to-hundreds of aggregated points (server pre-bucketed), far below where SVG rendering becomes a problem.
- **Bundle**: tree-shakeable; keep the existing pattern of `lazy()`-loading chart components so Recharts stays out of the entry chunk.

### 4.2 Rejected alternatives

| Library | Why rejected |
|---|---|
| **Tremor** | Built on Recharts anyway; post-Vercel-acquisition it pivoted to copy-paste blocks and the npm package is in maintenance mode — adds a second component system that overlaps shadcn/ui without adding capability. |
| **Nivo** | Best-in-class a11y defaults, but heavy bundle, brings its own theming (fights Tailwind tokens), and has unresolved bundler/RSC friction as of mid-2026. |
| **visx** | Low-level primitives (~15 kB, maximal control) but significantly more dev time per chart; overkill for standard dashboard charts. |
| **Chart.js / react-chartjs-2** | Canvas rendering shines at 10k–100k points we don't have; imperative config object clashes with the JSX/composition style; canvas is worse for a11y and CSS-variable theming. |
| **Apache ECharts** | Most powerful for huge datasets/drill-downs, but no first-party React API, large bundle unless imports are curated, and JSON-option styling doesn't integrate with Tailwind tokens. |

Sources: [LogRocket — Best React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/), [PkgPulse — Recharts vs Chart.js vs Nivo vs visx 2026](https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026), [shadcn/ui — Chart component](https://ui.shadcn.com/docs/components/radix/chart), [shadcn/ui — Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4), [Vercel acquires Tremor](https://vercel.com/blog/vercel-acquires-tremor), [Gerald Chen — React chart libraries comparison](https://chenguangliang.com/en/posts/blog152_react-chart-libraries-comparison/).

---

## 5. Metrics, KPIs & Chart Types per Dashboard

Legend: ▁ area/line, ▇ bar, ◔ donut/pie, ▦ heatmap-style grid, ▤ table, ● stat card (+sparkline).

### 5.1 My Insights (member — `/reports/me`)

| Metric | Source tables | Chart |
|---|---|---|
| Contribution trend (cards, votes, comments per week) | `card`, `vote`, `cardComment` | ▁ stacked area |
| Retros attended vs. team retros held | `retroParticipant`, `retrospective` | ▇ grouped bar |
| My action items: open / in-progress / completed / overdue | `actionItem` (assignee) | ◔ donut + ● |
| Action-item completion rate over time | `actionItem.updatedAt` | ▁ |
| Story estimate participation (rounds voted ÷ rounds held) | `storyEstimateVote`, `storyEstimateRound` | ● + sparkline |
| Agreement with consensus (my vote == `agreedPoints`) | `storyEstimateVote.points`, `round.agreedPoints` | ● % |

### 5.2 Team Health (team-lead full / member read-only aggregate — `/reports/team/$teamId`)

| Metric | Source | Chart |
|---|---|---|
| Health score + 4 component trends over periods | derived (existing formula, upgraded to use `retroParticipant`) | ▁ multi-line + radial gauge |
| Attendance rate per retro (true attendance) | `retroParticipant` ÷ `teamMember` | ▁ |
| Cards per retro by template column (sentiment mix: went-well vs. improve etc.) | `card.columnId` → `templateColumn.name` | ▇ stacked bar |
| Vote distribution / concentration (top-voted share) | `vote` per `card` | ▇ histogram |
| Discussion coverage (% cards discussed) | `card.isDiscussed` | ● + ▁ |
| Action items: completion rate, overdue aging buckets, **carry-forward rate** (`isCarriedForward`) | `actionItem` | ◔ + ▇ aging buckets + ▁ carry-forward trend |
| Per-assignee load & completion (**lead only**) | `actionItem.assigneeId` | ▤ + inline bars |
| Story estimates: consensus rate (rounds where votes converge / re-vote count), vote spread (distinct points per round), agreed-points velocity per session | `storyEstimateRound`, `storyEstimateVote` | ▁ velocity, ▇ spread, ● consensus % |
| Standup submission rate (if team uses standups) | `standupSubmission` ÷ expected | ▁ |

### 5.3 Organization (org-owner/org-admin — `/reports/org/$orgId`)

| Metric | Source | Chart |
|---|---|---|
| Members & teams growth | `organizationMember.createdAt`, `team.createdAt` | ▁ |
| Retro cadence per team per month | `retrospective` grouped by team × month | ▦ or ▇ small-multiples |
| Participation league (attendance rate per team) | `retroParticipant` | ▇ horizontal bar |
| Action-item completion by team | `actionItem` via retro→team | ▇ |
| Teams at risk (health < 40, no retro in 30d) | derived | ▤ with badges |
| Template usage (retro + story estimate templates) | `retrospective.templateId`, `storyEstimateSession.templateId` | ◔ |
| Story estimate throughput (stories estimated per team) | `storyEstimateRound` revealed | ▇ |

### 5.4 Platform (super-admin / system-admin — `/reports/platform`)

| Metric | Source | Chart |
|---|---|---|
| User growth + status funnel (pending→approved) | `user.createdAt`, `user.status` | ▁ + ◔ |
| Active users 7d/30d (distinct session users) | auth `session` | ● + ▁ |
| Orgs & teams created over time | `organization`, `team` | ▁ |
| Activity volume: retros, story estimate sessions, standups, surveys, polls, icebreaker sessions per week | respective tables | ▁ stacked area (feature adoption) |
| Org league table (members, teams, retros 30d, last activity) | joins | ▤ paginated |
| Cards/votes volume trend | `card`, `vote` | ▁ |

---

## 6. API Design

### 6.1 Module structure (fixes G1)

```
retro-tool-api/src/reports/
├── reports.module.ts
├── reports.controller.ts          # thin: routing + DTO validation only
├── reports.service.ts             # orchestration; delegates to query helpers
├── queries/                       # pure SQL aggregation builders (Drizzle)
│   ├── team-report.queries.ts
│   ├── org-report.queries.ts
│   ├── platform-report.queries.ts
│   └── personal-report.queries.ts
├── dto/
│   ├── report-range.dto.ts        # period|from/to + bucket (day|week|month), class-validator
│   ├── team-report-query.dto.ts   # range + optional memberId (lead-only)
│   ├── org-report-query.dto.ts    # range + pagination/search for league tables
│   └── platform-report-query.dto.ts
├── types/
│   └── index.ts                   # ALL response types (move from schema/index.ts)
└── guards/
    ├── team-report-access.guard.ts    # member of team; sets ctx.isLead
    ├── org-report-access.guard.ts     # org owner/admin or system-admin+
    └── system-report-access.guard.ts  # super-admin / system-admin
```

`schema/index.ts` interfaces move to `types/index.ts`; delete the misleading schema folder if no table is added.

### 6.2 Endpoints (v2, replacing current shape; old endpoints removed in final phase)

All return `{ range: {from,to,bucket}, ...payload }`. Time series are `Array<{ bucket: string; ...values }>` — pre-bucketed in SQL, chart-ready.

| Endpoint | Guard | Payload (types in `types/index.ts`) |
|---|---|---|
| `GET /reports/me` | AuthGuard | `PersonalReport`: contribution series, attendance, action items, story estimate participation/agreement |
| `GET /reports/teams/:teamId` | Team guard | `TeamReport`: KPIs + health + all §5.2 series; per-member fields present only when `isLead` |
| `GET /reports/teams/:teamId/members` | Team guard + lead check | `TeamMemberBreakdown[]` (paginated) |
| `GET /reports/organizations/:orgId` | Org guard | `OrgReport`: KPIs + growth + cadence heat data |
| `GET /reports/organizations/:orgId/teams` | Org guard | paginated team league (search, sort — **in SQL**) |
| `GET /reports/platform` | System guard | `PlatformReport`: growth, active users, feature adoption series |
| `GET /reports/platform/organizations` | System guard | paginated org league (SQL pagination) |

Design choices: one composite endpoint per dashboard (one round trip, consistent range) plus separate paginated table endpoints (independent refetch on page/search). `period` presets (`week|month|quarter|year`) kept but implemented as `from/to` sugar in `ReportRangeDto`.

### 6.3 Aggregation strategy (fixes G3, G6)

- Replace fetch-ids-and-count-in-JS with SQL: `count(*) FILTER (WHERE …)`, `GROUP BY date_trunc($bucket, …)`, `count(DISTINCT …)`, window functions for trends; Drizzle `sql` fragments where the builder falls short.
- Participation/attendance from `retroParticipant` (card-author contribution stays as a separate "contribution rate" metric).
- Story estimate consensus: per round, `count(DISTINCT points)` and comparison of vote mode vs. `agreedPoints`; re-vote detection via multiple rounds sharing `ticketNumber` in a session.
- League tables: `LIMIT/OFFSET` + `ILIKE` search in SQL, `count(*) OVER()` for totals — no in-memory slicing.
- Supporting indexes (new Drizzle migration): `retrospective(team_id, status, completed_at)`, `card(retro_id, author_id)`, `vote(card_id)`, `action_item(retro_id, status)`, `action_item(assignee_id, status)`, `story_estimate_round(session_id, status)`, `story_estimate_vote(session_id, voter_id)`, `retro_participant(retro_id, user_id)`, `session(user_id, updated_at)`. Verify against existing migrations in `retro-tool-api/drizzle/` before adding.

### 6.4 Caching

- **Phase 1 (ship with it):** HTTP `Cache-Control: private, max-age=60` + TanStack Query `staleTime` (5 min for org/platform, 1 min for team/me). Reports tolerate minutes of staleness.
- **Phase 2 (only if p95 > ~500 ms on staging):** in-process cache via `@nestjs/cache-manager` keyed `reports:{scope}:{id}:{rangeHash}` with 60–300 s TTL. Redis already runs in the stack if multi-instance coherence is ever needed.
- **Not planned:** materialized rollup tables / scheduled pre-aggregation — data volumes don't justify it yet; note as future option (`@nestjs/schedule` nightly rollup into a `report_snapshot` table) if platform growth demands.

---

## 7. Convex (`liveReports.ts`) Changes

Per the architecture rule, historical/analytical reporting moves fully to Postgres. Convex keeps only what benefits from live subscription:

1. **Keep** `getTeamStats` / `getUserStats` counters **only if** the dashboard home (`routes/dashboard/index.tsx`) or in-retro UI subscribes to them for live tickers. `routes/reports.tsx` does **not** use them today — verify dashboard usage; if nothing subscribes, **retire** the aggregates and their NestJS write hooks (removes write amplification on every card/vote).
2. **No new liveReports queries** for this feature. Live in-session stats (current retro's card/vote counts, story estimate round votes) already flow through `liveRetros.ts` / `liveEstimates.ts` projections.
3. If retirement is chosen: deprecate mutations first (no-op + log), remove NestJS callers, then delete aggregate components from `convex.config.ts` in a follow-up deploy. Read `convex-backend/convex/_generated/ai/guidelines.md` before touching any of this.

---

## 8. UI Design

### 8.1 Routes (TanStack Router file-based; router-owned names keep their conventions)

```
retro-tool-ui/src/routes/reports/
├── index.tsx                    # redirects to the best dashboard for the user's role
├── me.tsx                       # My Insights (all users)
├── team.$teamId.tsx             # Team health (member: aggregate; lead: full)
├── org.$orgId.tsx               # Organization dashboard
├── platform.tsx                 # Platform dashboard (system roles)
├── skeleton/
│   └── index.tsx                # shared route-group skeletons (per convention)
├── components/                  # kebab-case, colocated
│   ├── report-page-header.tsx   # title + range picker + export button
│   ├── report-range-picker.tsx
│   ├── stat-card.tsx            # value + delta + sparkline
│   ├── charts/                  # lazy-loaded chunk
│   │   ├── chart-container.tsx  # shadcn ChartContainer/Tooltip/Legend wrappers
│   │   ├── trend-area-chart.tsx
│   │   ├── stacked-bar-chart.tsx
│   │   ├── donut-chart.tsx
│   │   ├── health-gauge.tsx
│   │   └── cadence-heat-grid.tsx
│   ├── league-table.tsx         # generic paginated/searchable table (TanStack Table)
│   └── empty-report-state.tsx
├── hooks/
│   ├── use-report-range.ts      # range state synced to URL search params
│   ├── use-personal-report.ts
│   ├── use-team-report.ts
│   ├── use-org-report.ts
│   └── use-platform-report.ts
└── types/
    └── index.ts                 # mirrors API report types (or @retro-tool/contracts if extended)
```

Old `routes/reports.tsx` + `reports.skeleton.tsx` are deleted in the final phase; `/reports` remains valid via `reports/index.tsx` redirect (sidebar link unchanged in `app-sidebar.tsx`).

### 8.2 Data fetching

- Query keys: `['reports', scope, id, rangeKey]`; league tables add `{page, size, search}`.
- Route `loader` uses `queryClient.ensureQueryData` for the composite payload (suspense + `pendingComponent` skeleton); league tables use `useQuery` with `keepPreviousData`.
- Range in URL search params (`validateSearch` with Zod) so dashboards are shareable/bookmarkable.
- `staleTime` per §6.4; no polling — explicit Refresh button invalidates.
- Role gating for nav visibility from `useCurrentUser()` + org roles + `teamMember.tag` (via existing helpers in `src/lib/rbac.ts`); server guards remain the authority.

### 8.3 Charts & export

- All chart components under `components/charts/` are imported via `lazy()` from route components — a single "reports-charts" chunk; Recharts stays out of the main bundle.
- `accessibilityLayer` on every chart; `ChartContainer` themes via `--chart-1…5` CSS variables (add to the Tailwind theme if missing).
- Export: replace `document.write` print-window with the existing `jspdf` dependency (pattern already used in `routes/*/helpers/export-*-pdf.ts`) rendering charts via SVG→canvas; CSV export for league tables (client-side from fetched data).

---

## 9. RBAC Enforcement

- **Guards, not service asserts** (fixes G1/G8): three guards in `reports/guards/` built on the existing context builders from `src/lib/rbac.ts`:
  - `TeamReportAccessGuard`: builds `TeamContext`; rejects non-members (unless org admin+/system admin+); attaches `reportAccess: { isLead }` to the request. Controller/service uses `isLead` to include/exclude per-member fields; `/members` endpoint returns 403 when `!isLead`.
  - `OrgReportAccessGuard`: `organizationMember.role ∈ {org-owner, org-admin}` or system role — same cascade as today's `assertOrgAdmin`, but reusable and testable.
  - `SystemReportAccessGuard`: `user.role ∈ {super-admin, system-admin}`.
- Team-lead determination uses `teamMember.tag` (authoritative), never legacy `user.role` values.
- `/reports/me` is always self-scoped (never accepts a target userId). Per-member filters accept `memberId` only when `isLead`.
- Response-shaping stays server-side: a member calling `/reports/teams/:id` gets the aggregate `TeamReport` without `memberBreakdown` — no field the client must hide.
- Update `docs/RBAC.md` with a "Reports access" row in the team/org permission matrices.

---

## 10. Phased Roadmap, Estimates & Testing

Estimates are focused dev-days, excluding review. Run after every change: `pnpm --filter retro-tool-api type-check && lint`, `pnpm --filter retro-tool-ui type-check && lint`.

| Phase | Deliverable | Est. | Status |
|---|---|---|---|
| **0. Foundations** | Move types to `types/index.ts`; add `dto/` with `ReportRangeDto`; introduce the 3 guards while keeping current endpoints working; index migration (`db:generate`/`db:migrate`) | 2–3 d | ✅ Done (indexes defined in schemas — **generate + apply the migration locally**) |
| **1. API v2 — team + personal** | `queries/` layer (SQL aggregates + bucketed series), `GET /reports/me`, `GET /reports/teams/:teamId`, `/members`; attendance from `retroParticipant`; action-item carry-forward/aging; story estimate consensus/velocity | 4–5 d | ✅ Done (+ standup submission rate, personal completion trend) |
| **2. API v2 — org + platform** | `GET /reports/organizations/:orgId` (+`/teams`), `GET /reports/platform` (+`/organizations`); growth & adoption series; SQL pagination/search | 3–4 d | ✅ Done (+ cadence heat data) |
| **3. UI foundation** | `routes/reports/` structure, range picker + URL state, shadcn chart wrappers, stat-card + league-table, skeletons | 3 d | ✅ Done (URL-synced `?period=` via `validateSearch`; loaders + `useSuspenseQuery`) |
| **4. UI dashboards** | `me.tsx`, `team.$teamId.tsx` (lead vs. member variants), `org.$orgId.tsx`, `platform.tsx`; role-based redirect in `index.tsx` | 4–5 d | ✅ Done |
| **5. Exports & polish** | jspdf export, CSV for tables, empty states, a11y pass (`accessibilityLayer`, table semantics) | 2 d | ✅ Done (text-based PDF per dashboard; CSV on all league tables) |
| **6. Cleanup** | Delete old `reports.tsx`/tab page + legacy endpoints; retire unused Convex liveReports aggregates + NestJS write hooks (after usage audit); docs updates (`docs/RBAC.md`, READMEs) | 2 d | ✅ Done (audit found zero consumers/writers; liveReports.ts + 7 aggregates deleted; RBAC.md updated) |
| | **Total** | **~20–24 d** | |

Phases 1–2 can ship behind the existing UI (old page consumes v2 via adapter) if incremental release is preferred; otherwise cut over at Phase 4.

### Testing strategy

**API (Jest — `pnpm --filter retro-tool-api test`, serial `test:ci` in CI):**
- Unit: `queries/*` against a seeded test DB (bucketing edges: empty ranges, UTC truncation, single-retro teams); guard specs (member vs. lead vs. org-admin vs. system-admin cascade, 403 paths); DTO validation specs (bad period, from>to, pagination bounds).
- Controller specs: response shape per role (member payload must not contain `memberBreakdown`).
- Metric-correctness fixtures: known seed → exact expected numbers for health score, consensus rate, carry-forward rate. Snapshot current service outputs on the same fixtures *before* the SQL rewrite to catch unintended metric drift.

**UI (Vitest — `pnpm --filter retro-tool-ui test`):**
- Hook tests with mocked `api` (query keys, range param serialization, keepPreviousData behavior).
- Component tests (Testing Library): stat-card delta rendering, league-table pagination/search, role-conditional sections (lead-only blocks absent for member data), empty states, skeleton fallback.
- Route redirect logic in `reports/index.tsx` per role.
- Charts: render smoke tests (Recharts in jsdom via `ResizeObserver` mock) — assert data mapping, not pixels.

**Non-automated:** staging perf check (p95 per endpoint against seeded volume) before deciding on Phase-2 caching (§6.4).

---

## 11. Open Questions / Risks

1. **Convex aggregate retirement** — needs a usage audit of `dashboard` routes before deleting write hooks (§7).
2. **Standups/surveys/polls metrics** — §5 includes standup submission rate for teams and feature-adoption counts for platform; deeper survey/poll analytics are out of scope (they have their own report menus).
3. **Historical data for trends** — series are computed from raw tables, so trends are available retroactively; no backfill needed.
4. **Multi-team members** — `/reports/me` aggregates across teams with a per-team filter (existing `teamId` param pattern kept).
5. **`user.role` legacy values** (`org-admin`, `team-lead` in the user table) must never be consulted by the new guards — context builders only.
