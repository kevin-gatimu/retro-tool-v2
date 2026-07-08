# File naming conventions (UI)

This document defines how source files are named in **`retro-tool-ui`**. The goal is a single,
predictable rule across the whole frontend so files are easy to find and imports look uniform.

> **TL;DR:** File names are **`kebab-case`**. The thing a file *exports* keeps its idiomatic case —
> React components stay `PascalCase`, hooks stay `useCamelCase`. **File name ≠ export name.**

---

## The rule

| Kind of file | File name | Example file | Exports |
| --- | --- | --- | --- |
| React component | `kebab-case.tsx` | `notification-bell.tsx` | `export function NotificationBell()` |
| Hook | `use-kebab-case.ts` | `use-current-user.ts` | `export function useCurrentUser()` |
| Utility / non-React module | `kebab-case.ts` | `api-endpoints.ts` | `export const USERS_ENDPOINTS` |
| Types module | `index.ts` in a `types/` folder | `types/index.ts` | type declarations |
| Skeleton (loading) | `skeleton/index.tsx` (group) or `<name>.skeleton.tsx` (single) | `admin/skeleton/index.tsx`, `reports.skeleton.tsx` | `export function XSkeleton()` |

The hook `use-` prefix is meaningful — keep it on both the file (`use-…`) and the export (`useCamelCase`)
so React's rules-of-hooks tooling and readers both recognize it.

## The one exception — route files

Files under `retro-tool-ui/src/routes/` that define **routes** are named by **TanStack Router**, not by
this convention, because the file name maps to the URL. Leave these exactly as the router expects:

- `index.tsx`, `$teamId.tsx`, `$sessionId.tsx`, `__root.tsx`, `about.tsx`, `sign-in.tsx`, etc.

Everything else under a route folder still follows the kebab rule — `routes/admin/hooks/use-user-search.ts`,
`routes/retros/skeleton/index.tsx`, route-local components, etc.

## Why kebab-case

- `components/ui/` (shadcn) and `lib/` were **already** all-kebab, so this converges the entire tree on
  one rule without churning those directories.
- One rule covers components, hooks, and utilities — no per-kind exceptions to remember.
- Case-insensitive filesystems (Windows/macOS) can't disambiguate `Foo.tsx` from `foo.tsx`; kebab avoids
  case-only collisions and the git-history hazards that come with them.

## Examples

✅ **Do**

```
components/user-avatar.tsx          → export function UserAvatar()
components/spaces/space-switcher.tsx → export function SpaceSwitcher()
hooks/use-current-user.ts           → export function useCurrentUser()
routes/admin/hooks/use-user-search.ts → export function useUserSearch()
lib/api-endpoints.ts                → export const USERS_ENDPOINTS
```

❌ **Don't**

```
components/UserAvatar.tsx           # PascalCase file
hooks/useCurrentUser.ts            # camelCase file
components/userAvatar.tsx          # camelCase file
hooks/use_current_user.ts          # snake_case
```

## When adding a new file

1. Name the file in `kebab-case` (prefix hooks with `use-`).
2. Name the export idiomatically: `PascalCase` component, `useCamelCase` hook, `SCREAMING_SNAKE` const,
   etc.
3. Put module-specific types in a colocated `types/index.ts` (mirrors the API convention).
4. If it's a route, follow TanStack's file-routing naming instead.

## Renaming existing files

On case-insensitive filesystems, a pure case change (e.g. `Footer.tsx` → `footer.tsx`) must go through a
temporary name so git records it:

```bash
git mv Footer.tsx footer.tmp && git mv footer.tmp footer.tsx
```

Then update the **import path** (the segment after the last `/`); the imported identifier does not
change. `pnpm --filter retro-tool-ui type-check` will flag any path you missed.
