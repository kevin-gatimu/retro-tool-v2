# Plan: Story Estimate Templates

## Context

The retro tool supports retrospective templates but story estimate sessions have no template system — voting always shows the same 13 hardcoded POINT_VALUES (`['0','½','1','2','3','5','8','13','20','40','100','?','☕']` in `$sessionId.tsx:75-89`). The user wants a first-class estimate template system: 11 pre-built global templates, org/team-lead-managed org templates, a template-selection step in the new-session wizard, template browsing in `/templates`, CRUD in org settings, and full plug-and-play integration with the voting workflow (vote buttons, reveal display, consensus selection, revote, stats).

---

## Key Design: Value Storage + Display

The `estimateTemplateValue` table has two separate fields:
- **`label`** — what's shown in the UI: `"XS"`, `"•••"`, `"Green"`, `"½"`
- **`value`** — what gets stored in `story_estimate_vote.points`: always numeric-compatible where possible, so the existing `pointsToNumber()` helper computes stats correctly

| Template | label | value | Rationale |
|---|---|---|---|
| Fibonacci | `"½"`, `"1"`, `"∞"` | `"0.5"`, `"1"`, `"∞"` | Same — `½` is already handled by `pointsToNumber()` |
| T-shirt XS | `"XS"` | `"1"` | Maps to Fibonacci per the user's image (XS=1, S=2, M=3, L=5, XL=8) |
| T-shirt ? | `"?"` | `"?"` | Non-numeric — excluded from stats average (correct) |
| Risk Low | `"Low"` | `"1"` | Ordinal: Low=1, Medium=2, High=3, Critical=4 |
| Traffic Green | `"Green"` | `"1"` | Ordinal: Green=1, Amber=2, Red=3 |
| Dots •• | `"••"` | `"2"` | Count of dots as numeric |
| Hours 4h | `"4h"` | `"4"` | Numeric hours |
| Days 5d | `"5d"` | `"5"` | Numeric days |

The frontend maps `vote.points` → template `label` for display (e.g., stored `"1"` displayed as `"XS"`). The existing `pointsToNumber()` in `estimates.service.ts` handles all `value` fields without modification.

---

## Phase 1 — Backend: DB Schema & Migration

**Modify** `retro-tool-api/src/estimates/schema/index.ts`:

Add import: `import { organization } from '../../organizations/schema'`

Add `estimateTemplate` table:
```ts
export const estimateTemplate = pgTable('estimate_template', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  organizationId: varchar('organization_id', { length: 255 })
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
});
```

Add `estimateTemplateValue` table:
```ts
export const estimateTemplateValue = pgTable('estimate_template_value', {
  id: varchar('id', { length: 255 }).primaryKey(),
  templateId: varchar('template_id', { length: 255 })
    .notNull().references(() => estimateTemplate.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 20 }).notNull(),      // display: "XS", "½", "Green"
  value: varchar('value', { length: 20 }).notNull(),      // stored in votes: "1", "0.5", "1"
  order: integer('order').notNull().default(0),
  color: varchar('color', { length: 7 }),                 // optional hex: "#6366f1"
  description: text('description'),                       // tooltip/explanation
});
```

Add `templateId` nullable FK to `storyEstimateSession`:
```ts
templateId: varchar('template_id', { length: 255 })
  .references(() => estimateTemplate.id, { onDelete: 'set null' }),
```

Add type exports: `EstimateTemplate`, `NewEstimateTemplate`, `EstimateTemplateValue`, `NewEstimateTemplateValue`.

**Run** `pnpm --dir retro-tool-api db:generate` → produces `drizzle/0005_estimate_templates.sql`.

---

## Phase 2 — Backend: Seed Data

**Create** `retro-tool-api/src/common/data/built-in-estimate-templates.ts`

11 built-in templates, each with a description and per-value descriptions:

### 1. Fibonacci
> "Classic story estimate scale based on Fibonacci numbers. Gaps between values grow with complexity — making it harder to agree on large estimates, which encourages breaking down stories. The gold standard for agile estimation."

| label | value | description |
|-------|-------|-------------|
| ½ | 0.5 | Negligible effort — a config change or one-liner |
| 1 | 1 | Trivial, well understood, no surprises |
| 2 | 2 | Simple change with minor complexity |
| 3 | 3 | Small feature with some unknowns |
| 5 | 5 | Moderate complexity, needs investigation |
| 8 | 8 | Large task with significant unknowns |
| 13 | 13 | Very large — consider splitting |
| 21 | 21 | Epic-sized, must be decomposed |
| 34 | 34 | Too large to estimate accurately |
| 55 | 55 | Reserved for rough roadmap sizing |
| 89 | 89 | Reserved for rough roadmap sizing |
| ∞ | ∞ | Cannot estimate — needs a discovery spike |
| ? | ? | Not enough information to vote |

### 2. Modified Fibonacci
> "Extended Fibonacci favored by teams that deal with larger work items. The 13→20→40→100 jumps highlight uncertainty at scale and push teams to decompose large stories."

Values: ½(0.5), 1, 2, 3, 5, 8, 13, 20, 40, 100, ∞, ? — with similar descriptions, noting the larger gaps.

### 3. Powers of 2
> "Clean binary scale where each step doubles the previous. Relative sizing differences are unambiguous. Great for teams that prefer mathematical clarity over narrative."

Values: 1, 2, 4, 8, 16, 32, 64, ? — each described as "2× the previous tier".

### 4. T-shirt Sizes
> "Intuitive size-based scale using clothing metaphors. Perfect for quick feature sizing, product roadmaps, and non-technical stakeholders. Maps to Fibonacci points: XS=1, S=2, M=3, L=5, XL=8, XXL=13."
Theme color: #f43f5e (rose)

| label | value | description |
|-------|-------|-------------|
| XS | 1 | Trivial change — a few hours of work |
| S | 2 | Small task — about half a day |
| M | 3 | Medium — 1–2 days |
| L | 5 | Large — 3–5 days |
| XL | 8 | Extra large — up to 2 weeks |
| XXL | 13 | Very large — needs decomposition |
| ? | ? | Cannot estimate without more information |

### 5. Hours
> "Direct time estimation in hours. Best for well-scoped tasks where duration is predictable. Encourages precision but works best for sub-day stories."
Theme color: #f59e0b (amber)

| label | value | description |
|-------|-------|-------------|
| 1h | 1 | One hour of focused work |
| 2h | 2 | Two hours |
| 4h | 4 | Half a working day |
| 6h | 6 | Most of a working day |
| 8h | 8 | Full working day |
| 16h | 16 | Two full days |
| 24h | 24 | Three days — consider splitting |
| ? | ? | Duration unknown |

### 6. Days
> "Estimation in whole working days. Simpler than hours for multi-day tasks. Use when hour-level precision isn't needed or when planning at sprint level."
Theme color: #f97316 (orange)

Values: 1d(1), 2d(2), 3d(3), 5d(5), 10d(10), ? — described as working days.

### 7. Linear (1–10)
> "Simple 1–10 difficulty score. Each number represents relative complexity. Great for teams new to agile estimation who find Fibonacci confusing."
Theme color: #10b981 (emerald)

Values: 1 through 10 plus ?, each described by complexity level (1=trivial, 5=average, 10=extremely complex).

### 8. Dots (1–5)
> "Visual dot notation for expressive, intuitive estimation. Ideal for workshops, roadmap reviews, and mixed technical/non-technical groups. Each dot = one unit of effort."
Theme color: #0ea5e9 (sky)

| label | value | description |
|-------|-------|-------------|
| • | 1 | Minimal effort |
| •• | 2 | Light effort |
| ••• | 3 | Moderate effort |
| •••• | 4 | Significant effort |
| ••••• | 5 | Maximum effort in this scale |
| ? | ? | Cannot estimate |

### 9. Risk
> "Risk assessment scale for evaluating uncertainty, impact, and delivery confidence. Use alongside story points to flag stories that need more investigation before committing."
Per-value colors: Low=#22c55e, Medium=#f59e0b, High=#ef4444, Critical=#7c3aed

| label | value | description |
|-------|-------|-------------|
| Low | 1 | Well understood, minimal unknowns, minimal risk |
| Medium | 2 | Some unknowns, manageable with standard practices |
| High | 3 | Significant unknowns, requires careful planning or spike |
| Critical | 4 | Highly uncertain — escalate, spike, or descope |

### 10. Team Confidence
> "Team confidence score measuring how certain the team feels about successfully delivering a story. Pair with complexity estimates to surface hidden risk. Low confidence = needs discussion before committing."
Theme color: #14b8a6 (teal)

Values: 1–5, described from "Very low confidence" to "Full confidence, well understood".

### 11. Easy / Medium / Hard
> "Simple 3-point difficulty scale. Great for quick scoping, non-technical teams, or early backlog triage when you just need a rough cut. Each level maps to a Fibonacci range: Easy=1, Medium=2–4, Hard=5–8."
Theme color: #6366f1 (indigo)
Per-value colors: Easy=#22c55e, Medium=#f59e0b, Hard=#ef4444

| label | value | description |
|-------|-------|-------------|
| Easy | 1 | Simple, minimal effort — a few hours at most |
| Medium | 3 | Moderate effort, some complexity or unknowns |
| Hard | 8 | Complex, high effort — consider breaking down |

### 12. Classic Story Estimate
> "The most widely used story estimate scale. Starts at 0 for trivial no-ops and tops out at 100 for very rough epic sizing. The standard scale found in most agile estimation kits."
Theme color: #8b5cf6 (violet)

Values: 0(0), 1(1), 2(2), 3(3), 5(5), 8(8), 13(13), 20(20), 40(40), 100(100) — described similarly to Modified Fibonacci.

### 13. Fibonacci with Coffee
> "Extended story estimate scale with two special cards. '?' means the team needs more information before estimating. '☕' signals the item is too large and the team needs a break or a splitting session. The most expressive Fibonacci deck."
Theme color: #d946ef (fuchsia)

| label | value | description |
|-------|-------|-------------|
| 0 | 0 | No effort — already done or trivial no-op |
| ½ | 0.5 | Negligible, under an hour |
| 1 | 1 | Trivial, well understood |
| 2 | 2 | Simple, minor complexity |
| 3 | 3 | Small, some unknowns |
| 5 | 5 | Moderate complexity |
| 8 | 8 | Large, significant unknowns |
| 13 | 13 | Very large — consider splitting |
| 20 | 20 | Too large, needs decomposition |
| 40 | 40 | Epic-sized |
| 100 | 100 | Rough roadmap sizing only |
| ? | ? | Need more information before estimating |
| ☕ | ☕ | Too complex — take a break and split the story |

### 14. Linear (1–7)
> "Compact linear scale for teams that want simplicity without the gaps of Fibonacci. Seven distinct values cover the full range from trivial to very complex without overwhelming participants."
Theme color: #0284c7 (blue)

Values: 1(1), 2(2), 3(3), 4(4), 5(5), 6(6), 7(7) — described from "trivial" to "very complex, needs splitting".

---

## Phase 3 — Backend: `EstimateTemplatesModule`

**Create** these files:

#### `retro-tool-api/src/estimate-templates/estimate-templates.module.ts`
Standard NestJS module, imports `DatabaseModule`.

#### `retro-tool-api/src/estimate-templates/dtos/create-estimate-template.dto.ts`
```ts
z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  organizationId: z.string().optional(),
  values: z.array(z.object({
    label: z.string().min(1).max(20),
    value: z.string().min(1).max(20),
    order: z.number().int().min(0).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    description: z.string().max(500).optional(),
  })).min(1).max(30),
})
```

#### `retro-tool-api/src/estimate-templates/dtos/update-estimate-template.dto.ts`
All fields optional. `values` (if provided) fully replaces existing values.

#### `retro-tool-api/src/estimate-templates/estimate-templates.service.ts`

Key methods:
- `getTemplatesPaginated(userId, page, limit, type?, search?)` — returns `{ templates, total, page, limit }`. Each template includes nested `values[]` sorted by `order`. Visible: `isBuiltIn=true` + org templates for orgs the user belongs to. System-admins see all.
- `getTemplateById(id)` — returns template + values.
- `createTemplate(userId, dto)` — calls `assertAccess(userId, dto.organizationId)`, inserts template + values.
- `updateTemplate(userId, id, dto)` — fetches existing for `organizationId`, calls `assertAccess`, replaces values (delete-all, insert-new).
- `deleteTemplate(userId, id)` — calls `assertAccess`. DB cascade removes `estimateTemplateValue`. `ON DELETE SET NULL` on sessions preserves all session history.
- `seedBuiltInTemplates()` — idempotent: check by ID then by name before inserting.

**RBAC (`assertAccess`):**
- `organizationId` null (global) → require `system-admin` or `super-admin`
- `organizationId` set → allow system/super-admin unconditionally. Otherwise check `organizationMember.role IN ('owner','admin')` OR `teamMember.tag = 'lead'` where `team.organizationId = organizationId`

This is broader than retro templates (which only allow org-owner/admin, not team-lead).

#### `retro-tool-api/src/estimate-templates/estimate-templates.controller.ts`
```
GET    /estimates/templates          paginated list (page, limit, type, search)
GET    /estimates/templates/:id      single template with values
POST   /estimates/templates          create
PATCH  /estimates/templates/:id      update
DELETE /estimates/templates/:id      delete
POST   /estimates/templates/seed     seed built-ins (super-admin only)
```
All routes: `@UseGuards(AuthGuard)`, inject `@Session()`.

---

## Phase 4 — Backend: Wire Up + Session API Integration

**Modify** `retro-tool-api/src/app.module.ts`: add `EstimateTemplatesModule` to imports.

**Modify** `retro-tool-api/src/estimates/dtos/create-estimate-session.dto.ts`: add `templateId: z.string().optional()`.

**Modify** `retro-tool-api/src/estimates/estimates.service.ts`:
1. In `createSession()`: pass `templateId: data.templateId ?? null` in the insert.
2. In `getSession()`: if `session.templateId` is set, LEFT JOIN `estimateTemplate` and `estimateTemplateValue` and include them in the response as `template: { id, name, values[] } | null`.

**Modify** `retro-tool-api/src/estimates/types/index.ts`: add `template` field to `SessionDetail`:
```ts
template: {
  id: string
  name: string
  values: { id: string; label: string; value: string; order: number; color: string | null; description: string | null }[]
} | null
```

**Create** `retro-tool-api/src/seed/seed-estimate-templates.ts`: idempotent seed script.

**Modify** `retro-tool-api/package.json`: add `db:seed:estimate-templates`; extend `db:seed` to include it.

---

## Phase 5 — Frontend: Types & Endpoints

**Modify** `retro-tool-ui/src/common/types/estimates.ts`:
- Add `EstimateTemplateValue`, `EstimateTemplate`, `PaginatedEstimateTemplatesResponse`, `CreateEstimateTemplateInput`
- Extend `CreateSessionInput` with `templateId?: string`
- Add `template: EstimateTemplate | null` field to `EstimateSession` (the session detail type)

**Modify** `retro-tool-ui/src/lib/api-endpoints.ts`:
```ts
export const ESTIMATE_TEMPLATES_ENDPOINTS = {
  LIST: '/api/estimates/templates',
  SEED: '/api/estimates/templates/seed',
  BY_ID: (id: string) => `/api/estimates/templates/${id}`,
} as const
```

---

## Phase 6 — Frontend: `EstimateTemplateCard` Component

**Create** `retro-tool-ui/src/components/EstimateTemplateCard.tsx`

Props: `template`, `selected?`, `onSelect?`, `showActions?`, `onEdit?`, `onDelete?`.

Visual identity detected from `template.name.toLowerCase()`:

**T-shirt** (contains `'t-shirt'` or `'t shirt'`):
Render a row of SVG shirts that scale with size tier. Each shirt is a 16×20 viewBox SVG with:
- Body path with slight 3D depth
- White collar highlight ellipse (opacity 0.3)
- Left/right sleeve shadow triangles (black opacity 0.2)
- Bottom fold line
Scale: XS=0.75, S=0.85, M=1.0, L=1.15, XL=1.3, XXL=1.45 via `transform="scale(N)"`
Each shirt uses the template's `color` field (rose #f43f5e) as `currentColor`.

```svg
<svg viewBox="0 0 16 20" width="N" height="N*1.25" style={{color: template.color}}>
  <path d="M5,4 L2,7 L0,5 L2,17 L14,17 L16,5 L14,7 L11,4 Q8,6.5 5,4Z" fill="currentColor"/>
  <ellipse cx="8" cy="4.5" rx="3" ry="1.2" fill="white" opacity="0.3"/>
  <path d="M2,7 L0,5 L2,9Z" fill="black" opacity="0.2"/>
  <path d="M14,7 L16,5 L14,9Z" fill="black" opacity="0.2"/>
  <line x1="2" y1="17" x2="14" y2="17" stroke="black" strokeWidth="0.3" opacity="0.3"/>
</svg>
```

**Risk**: colored `Badge` chips using per-value `color`.

**Dots**: render label characters in `font-mono text-xl` in muted pill.

**Numeric / default**: rounded pill badges with optional `color` tint.

Card layout:
- Header: template name + "Built-in"/"Org Name" badge
- Optional description (2-line clamp)
- Value visuals row (horizontally scrollable, max 10 items shown + overflow count)
- Optional edit/delete buttons (when `showActions`)

---

## Phase 7 — Frontend: Session Voting — Plug-and-Play Integration

**Modify** `retro-tool-ui/src/routes/estimate/$sessionId.tsx`

**Vote buttons (plug-and-play):**

Replace hardcoded `POINT_VALUES` with:
```ts
const DEFAULT_POINT_VALUES = [
  { label: '0', value: '0' }, { label: '½', value: '0.5' }, { label: '1', value: '1' },
  { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '5', value: '5' },
  { label: '8', value: '8' }, { label: '13', value: '13' }, { label: '20', value: '20' },
  { label: '40', value: '40' }, { label: '100', value: '100' }, { label: '?', value: '?' },
  { label: '☕', value: '☕' },
]

const voteOptions = session.template
  ? session.template.values.map(v => ({ label: v.label, value: v.value, color: v.color, description: v.description }))
  : DEFAULT_POINT_VALUES
```

Vote buttons use `option.value` when submitting (`castVoteMutation.mutate({ points: option.value })`) and display `option.label`. When a template value has a `color`, tint the button background. Show `option.description` as a tooltip (`<Tooltip>`) on hover.

**Revealed vote display (label mapping):**

When rendering participant vote cards after reveal, if `session.template` is set:
```ts
const displayVote = (points: string) => {
  if (!session.template) return points
  return session.template.values.find(v => v.value === points)?.label ?? points
}
```
Use `displayVote(vote.points)` instead of raw `vote.points` in the participant grid.

**T-shirt visual in vote cards:**
For T-shirt template, render a small inline SVG shirt in the vote card instead of just the label text.

**Consensus selection:**

When `session.status === 'revealed'` and `session.template` is set, render template value quick-select buttons above the current free-text input:
```tsx
{session.template && (
  <div className="flex flex-wrap gap-2 mb-2">
    {session.template.values.filter(v => v.value !== '?').map(v => (
      <Button key={v.id} variant={agreedPoints === v.value ? 'default' : 'outline'}
        size="sm" onClick={() => handleAgreedPointsChange(v.value)}>
        {v.label}
      </Button>
    ))}
  </div>
)}
```
The existing debounced text input remains below for free-form overrides.

**Revote:** No changes needed — revote resets votes but keeps the session's `templateId`, so the same template vote buttons reappear automatically.

**Stats display:** No changes to `pointsToNumber()` — it naturally handles all `value` strings. For templates where values are labeled (T-shirt, Risk, Traffic Light), the revealed-round stats show numeric averages mapped back to the closest label when possible:
```ts
const closestLabel = (avg: number | null): string | null => {
  if (!avg || !session.template) return null
  const numeric = session.template.values
    .map(v => ({ label: v.label, n: parseFloat(v.value) }))
    .filter(v => !isNaN(v.n))
    .sort((a, b) => Math.abs(a.n - avg) - Math.abs(b.n - avg))
  return numeric[0]?.label ?? null
}
```
Show `closestLabel` as a hint next to the numeric average (e.g., "Avg: 3 (~M)").

---

## Phase 8 — Frontend: `/templates` Page

**Modify** `retro-tool-ui/src/routes/templates.tsx`

Wrap existing content in `<Tabs>` with two tabs:
- `"retro"` — existing content (unchanged)
- `"estimate"` — new `EstimateTemplatesSection` (inline component)

`EstimateTemplatesSection`:
- Two query sections (org templates + global), each paginated
- `useQuery(['estimate-templates', type, page, limit, search])` → `ESTIMATE_TEMPLATES_ENDPOINTS.LIST`
- Renders `<EstimateTemplateCard>` grid
- "New Template" button visible for `isOrgAdmin || isSysAdmin`
- `CreateEstimateTemplateDialog`: name, description, org selector, dynamic values list (each row: label, value, optional color `<input type="color">`, optional description)

Loader: add `queryClient.ensureQueryData` for both estimate template pages alongside existing retro template prefetches.

---

## Phase 9 — Frontend: `/estimate/new` Wizard

**Modify** `retro-tool-ui/src/routes/estimate/new.tsx` — convert to 4-step wizard matching `retros/new.tsx` exactly.

```ts
type Step = 'template' | 'team' | 'settings' | 'confirm'
```

State: `step`, `selectedTemplateId` (optional), `selectedTeamId`, `sessionName`, `sprintLink`, `timerDuration`, `orgTemplatePage`, `globalTemplatePage`.

**canProceed per step:**
- `template`: always `true` (template is optional — show "Next" + "Skip template" secondary link)
- `team`: `!!selectedTeamId`
- `settings`: `sessionName.trim().length > 0`
- `confirm`: `true`

**Template step:** Org templates + global templates sections, each paginated. `EstimateTemplateCard` with selected ring. "No template" chip-button for explicitly opting out. Template preview tooltip on hover.

**Team step:** Card grid of user's team memberships (same as retro wizard).

**Settings step:** Session name (required), sprint link (optional, URL validated), timer select (No timer / 1m / 2m / 3m / 5m).

**Confirm step:** Summary showing: selected template name + first 6 value pills (or "No template"), team name, session settings.

**Mutation:** Pass `templateId: selectedTemplateId ?? undefined`.

**Loader:** Add `queryClient.ensureQueryData` for both estimate template queries.

Progress indicator: same numbered-circles component as `retros/new.tsx`.

---

## Phase 10 — Frontend: Org Settings Templates Sub-tabs

**Modify** `retro-tool-ui/src/routes/organizations/$orgId.tsx`

Compute: `const isTeamLeadInOrg = teamsData?.teams.some(t => t.myRole === 'team-lead') ?? false`

Tab trigger: `{(isAdmin || isTeamLeadInOrg) && <TabsTrigger value="templates">Templates</TabsTrigger>}`

Inside `<TabsContent value="templates">`, add nested `<Tabs defaultValue="retro">`:
- `"retro"` sub-tab: existing retro template CRUD (guarded by `isAdmin`)
- `"estimate"` sub-tab: new `OrgEstimateTemplatesSection` (accessible to `isAdmin || isTeamLeadInOrg`)

Extract existing retro template CRUD into inline `RetroTemplatesSection` component to keep the file readable.

`OrgEstimateTemplatesSection` (inline):
- Fetches `['org-estimate-templates', orgId]` → `ESTIMATE_TEMPLATES_ENDPOINTS.LIST?type=organization` then client-filters by `organizationId === orgId`
- `<EstimateTemplateCard showActions>` grid with Edit/Delete buttons
- `CreateEstimateTemplateDialog` / `EditEstimateTemplateDialog` (Dialog with values list)
- Delete `AlertDialog` with warning that sessions using the template will lose the template association (but all vote/round data is preserved)
- All mutations invalidate `['org-estimate-templates', orgId]`

---

## Phase 11 — Frontend: Admin Panel `/admin/templates`

**Modify** `retro-tool-ui/src/routes/admin/templates.tsx`

Wrap the entire existing page body in `<Tabs defaultValue="retro">` with two tabs at the top:
- `"retro"` — "Retrospective Templates"
- `"estimate"` — "Story Estimate Templates"

### Retro tab (`"retro"`)
Keep all existing functionality unchanged (search, type filter, sort, pagination, seed button, create, edit, delete). Add one new action to the row dropdown: **View** — opens a read-only view modal.

**View modal** (new `TemplateViewDialog` component in the same file):
- Full-screen-friendly `Dialog` (`max-w-2xl`)
- Header: template name + Built-in/Org badge + description
- Columns section: each column rendered as a styled card showing emoji, name, and prompt
- Footer: metadata (Created date, Organization)
- No edit controls — read-only

### Estimate tab (`"estimate"`)
A new `AdminEstimateTemplatesTab` component (inline or in a new file `admin/estimate-templates-tab.tsx`). It replicates all retro template features:

**Search:** Debounced text input (300ms), resets page on change, appends `&search=<term>`.

**Filter:** Type dropdown — `all` / `built-in` / `organization`. Resets page on change.

**Sort:** Sortable `name` and `createdAt` columns via `SortableHeader`.

**Pagination:** Same pattern — rows-per-page select (10/20/50/100), Prev/Next, "Showing X of Y", Page N of M, Refresh button. Uses `['admin-estimate-templates', ...]` query key.

**Table columns:** Name (sortable), Type (Built-in/Org badge), Description, Values (count badge), Created (sortable), Actions.

**Header buttons:**
- "Seed Built-in" → `POST /api/estimates/templates/seed` (`seedEstimateMutation`)
- "New Template" → opens `EstimateTemplateForm` dialog

**Row actions (dropdown):**
- **View** → `EstimateTemplateViewDialog` (read-only modal)
- **Edit** → `EstimateTemplateForm` dialog pre-populated
- **Delete** → confirmation `AlertDialog`

**`EstimateTemplateViewDialog`** (styled read-only modal):
- `max-w-2xl` Dialog, `max-h-[90vh] overflow-y-auto`
- Header section: template name + Built-in/Org badge + description block
- Template style indicator: a small preview using `EstimateTemplateCard` (import the component)
- Values grid: each value as a styled card showing: color swatch (if set), label (large bold), value (muted subtitle), description (if set)
- T-shirt values render the SVG shirt inline in each card
- Footer: org name, created date, value count

**`EstimateTemplateForm`** (create/edit dialog):
- `max-w-2xl` Dialog, `max-h-[90vh] overflow-y-auto`
- Fields: Name (required Input), Description (Textarea), Organization (Select — all orgs for sysadmin, own orgs for others)
- Values list: dynamic add/remove rows, each row has:
  - Label input (required, max 20 chars)
  - Value input (required, max 20 chars, helper text: "stored in votes")
  - Color picker `<input type="color">` with swatch preview
  - Description input (optional)
  - Remove button
- "Add Value" button at bottom of list
- Max 30 values enforced

**Query keys:**

```ts
['admin-estimate-templates', page, pageSize, debouncedSearch, typeFilter, sortParam, sortOrderParam]
['admin-all-organizations']  // reuse existing
```

**API endpoints used:**

| Operation | Method | URL |
|---|---|---|
| List estimate templates | GET | `/api/estimates/templates?page=N&limit=N[&search=...][&type=...][&sort=...][&sortOrder=...]` |
| Seed built-in | POST | `/api/estimates/templates/seed` |
| Create | POST | `/api/estimates/templates` |
| Update | PATCH | `/api/estimates/templates/:id` |
| Delete | DELETE | `/api/estimates/templates/:id` |

**Mutation hook:** Create `retro-tool-ui/src/routes/admin/hooks/useAdminEstimateTemplateMutations.ts` mirroring `useAdminTemplateMutations.ts`. Invalidates `['admin-estimate-templates']` on all mutations.

---

## Files to Create

| File | Purpose |
|------|---------|
| `retro-tool-api/src/estimate-templates/estimate-templates.module.ts` | NestJS module |
| `retro-tool-api/src/estimate-templates/estimate-templates.controller.ts` | REST controller |
| `retro-tool-api/src/estimate-templates/estimate-templates.service.ts` | Business logic + RBAC |
| `retro-tool-api/src/estimate-templates/dtos/create-estimate-template.dto.ts` | Create DTO |
| `retro-tool-api/src/estimate-templates/dtos/update-estimate-template.dto.ts` | Update DTO |
| `retro-tool-api/src/estimate-templates/dtos/index.ts` | Barrel export |
| `retro-tool-api/src/common/data/built-in-estimate-templates.ts` | 11 pre-built templates with descriptions |
| `retro-tool-api/src/seed/seed-estimate-templates.ts` | Idempotent seed script |
| `retro-tool-api/drizzle/0005_estimate_templates.sql` | Migration (generated by db:generate) |
| `retro-tool-ui/src/components/EstimateTemplateCard.tsx` | Visual template card with T-shirt SVG |
| `retro-tool-ui/src/routes/admin/hooks/useAdminEstimateTemplateMutations.ts` | Admin CRUD mutations for estimate templates |

## Files to Modify

| File | Change |
|------|--------|
| `retro-tool-api/src/estimates/schema/index.ts` | Add 2 new tables + templateId FK on session |
| `retro-tool-api/src/estimates/dtos/create-estimate-session.dto.ts` | Add optional `templateId` |
| `retro-tool-api/src/estimates/estimates.service.ts` | Pass `templateId` in createSession; join template in getSession |
| `retro-tool-api/src/estimates/types/index.ts` | Add `template` field to `SessionDetail` |
| `retro-tool-api/src/app.module.ts` | Register `EstimateTemplatesModule` |
| `retro-tool-api/package.json` | Add `db:seed:estimate-templates` script |
| `retro-tool-ui/src/common/types/estimates.ts` | Add template types; add `template` to `EstimateSession` |
| `retro-tool-ui/src/lib/api-endpoints.ts` | Add `ESTIMATE_TEMPLATES_ENDPOINTS` |
| `retro-tool-ui/src/routes/templates.tsx` | Add Tabs + estimate templates tab |
| `retro-tool-ui/src/routes/estimate/new.tsx` | Convert to 4-step wizard |
| `retro-tool-ui/src/routes/estimate/$sessionId.tsx` | Template-aware vote buttons, display, consensus |
| `retro-tool-ui/src/routes/organizations/$orgId.tsx` | Split Templates tab into sub-tabs |
| `retro-tool-ui/src/routes/admin/templates.tsx` | Add Tabs (Retro / Story Estimate), View modal for retro templates, full estimate templates tab |

---

## Verification

1. `pnpm --filter retro-tool-api db:generate` → verify SQL has `estimate_template`, `estimate_template_value`, and `template_id` column on session
2. `pnpm --dir retro-tool-api db:migrate` → applies migration
3. `pnpm --dir retro-tool-api db:seed:estimate-templates` → seeds 14 templates
4. `GET /api/estimates/templates` → returns 14 built-in templates with values and descriptions
5. Create a session with `templateId=<fibonacci-id>` → session detail returns `template: { name: "Fibonacci", values: [...] }`
6. Open session voting page → vote buttons show Fibonacci values (½, 1, 2, 3, 5, 8...) not the hardcoded defaults
7. Cast vote → stored `points = "5"` for Fibonacci 5
8. Create session with T-shirt template → vote buttons show SVG shirts labeled XS/S/M/L/XL
9. Reveal votes → XS votes display as "XS" (label), not "1" (value)
10. Consensus UI shows T-shirt quick-select buttons when template is active
11. Revote → same template vote buttons still appear
12. Delete T-shirt template → existing session still works, templateId becomes null, falls back to default POINT_VALUES
13. `/templates` page → two tabs; "Story Estimate Templates" tab shows 11 cards including 3D shirt card
14. `/estimate/new` → 4-step wizard; template step shows estimate template cards
15. `/organizations/:orgId` → Templates → "Story Estimates" sub-tab → CRUD works
16. `pnpm --filter retro-tool-api type-check && pnpm --filter retro-tool-ui type-check` → both pass
17. `pnpm --filter retro-tool-api lint && pnpm --filter retro-tool-ui lint` → both pass
