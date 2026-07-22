# User Guide (VitePress docs app)

The **end-user guide** — the product documentation a customer reads — is a
[VitePress](https://vitepress.dev) site that lives **inside the frontend app**
and is served same-origin at **`/docs`** (e.g. `https://<app-host>/docs`,
`/docs/story-estimates/`).

This document is for **maintainers**: how the docs app is wired, how to run it,
how to add pages and images, and how it ships. It is **not** the guide itself —
the guide's content lives in `retro-tool-ui/docs/`.

> **Two different "docs" — don't confuse them.**
> - `retro-tool-v2/docs/` (this folder) — **internal/maintainer** documentation (architecture, security, workflows, guidelines). Not shipped to users.
> - `retro-tool-v2/retro-tool-ui/docs/` — the **VitePress user guide** shipped to users at `/docs`. That is what this document describes.

---

## Why it's built this way

- **Same origin, one deploy.** The guide is served from the same host as the app
  (`/docs`) — no second domain, no separate deploy target. The VitePress build
  emits its output *into the SPA's build output* (`dist/docs/`), so the existing
  Azure Static Web App (SWA) ships both from one artifact.
- **Markdown + images, easy to edit.** Pages are plain `.md` files; images live
  in `docs/public/`. No code changes needed to add or edit a page.
- **Public, no auth.** The guide is readable without signing in.

---

## Where everything lives

```
retro-tool-ui/
├── docs/                         # ← the VitePress user guide (source)
│   ├── .vitepress/
│   │   ├── config.ts             # site config: base, outDir, nav, sidebar
│   │   └── theme/
│   │       ├── index.ts          # custom theme: binds medium-zoom for click-to-zoom images
│   │       └── custom.css        # theme overrides
│   ├── public/                   # images & static assets (served at /docs/…)
│   ├── index.md                  # home page (hero layout)
│   ├── retrospectives/           # Retrospectives section
│   ├── story-estimates/          # Story Estimates section
│   ├── standups/                 # Standups section
│   ├── icebreakers/              # Icebreakers section
│   ├── polls/                    # Polls section
│   └── surveys/                  # Surveys section
├── public/
│   └── staticwebapp.config.json  # SWA routing — excludes /docs/* from SPA fallback
├── package.json                  # docs:* scripts + combined build
└── dist/                         # build output (git-ignored)
    ├── index.html                #   the SPA
    └── docs/                     #   the VitePress guide (base: /docs/)
```

Key config values in `retro-tool-ui/docs/.vitepress/config.ts`:

| Option | Value | Why |
| --- | --- | --- |
| `base` | `'/docs/'` | Served under the `/docs` sub-path; prepended to all absolute asset URLs. |
| `outDir` | `'../dist/docs'` | Emits into the SPA's `dist/` so one SWA artifact serves both. Resolved relative to `docs/`, i.e. `retro-tool-ui/dist/docs`. |
| `cleanUrls` | `true` | `/docs/story-estimates/` instead of `…/index.html`. |
| `themeConfig.nav` / `sidebar` | — | Top nav + per-section sidebar. |

### Click-to-zoom screenshots

The custom VitePress theme at `retro-tool-ui/docs/.vitepress/theme/index.ts`
extends `DefaultTheme` and binds [medium-zoom](https://github.com/francoischalifour/medium-zoom)
to every image inside `.vp-doc` (i.e. every screenshot in a guide page, but not
nav/sidebar icons). Clicking an image lifts it into a full-screen dark overlay
so wide screenshots stay readable on small screens. Because VitePress swaps
page content client-side without a full reload, the theme rebinds `medium-zoom`
on `onMounted` and again on every route change (`watch(() => route.path, …)`
and `router.onAfterRouteChange`).

### Header nav link (in the SPA)

The authenticated app shell (`retro-tool-ui/src/routes/__root.tsx`) renders a
**"User Guide"** button in the header that links to `/docs/`. Since the guide
is a separate VitePress site outside the SPA's router, this is a plain `<a>`
tag (not a TanStack `Link`) with `target="_blank" rel="noreferrer"`, so it
opens the guide in a new tab without disturbing the app's client-side routing.

---

## Running it locally

All commands run from the repo root (or use `pnpm --filter retro-tool-ui <script>`).

| Command | Port | Serves |
| --- | --- | --- |
| `pnpm --filter retro-tool-ui docs:dev` | 5173 (next free) | **Guide only**, hot-reloading. Best for writing docs. |
| `pnpm --filter retro-tool-ui dev` | 3000 | **App only** (the SPA), hot-reloading. |
| `pnpm --filter retro-tool-ui build` | — | Builds **both** into `dist/` (SPA) and `dist/docs/` (guide). |
| `pnpm --filter retro-tool-ui preview` | 3000 (next free) | Serves the **built** app + guide together on one port — mirrors production. |

> **Ports differ only in dev.** `docs:dev` runs VitePress's own dev server on a
> separate port (e.g. 5174) — that's a local authoring convenience, not how it's
> served. In production (and via `pnpm preview`) the app and guide share **one**
> origin: `/` is the app, `/docs` is the guide.

### The usual authoring loop

```bash
pnpm --filter retro-tool-ui docs:dev
# edit retro-tool-ui/docs/**/*.md — changes hot-reload in the browser
```

### Verifying a production-style build

```bash
pnpm --filter retro-tool-ui build         # produces dist/ + dist/docs/
pnpm --filter retro-tool-ui preview       # open the printed URL, visit /docs
```

You should find both `dist/index.html` (SPA) and `dist/docs/index.html` (guide),
with guide assets under `dist/docs/assets/…`.

---

## Adding a page

1. Create a `.md` file under `retro-tool-ui/docs/` (kebab-case path), e.g.
   `docs/story-estimates/creating-a-session.md`.
2. Add it to the sidebar/nav in `docs/.vitepress/config.ts` so it's linked.
3. Reference images with an absolute path from the `public/` root — because
   `base` is `/docs/`, an image at `docs/public/story-estimates/create.png` is
   referenced in Markdown as `/story-estimates/create.png` and served at
   `/docs/story-estimates/create.png`.
4. Run `docs:dev` and confirm it renders.

Standard VitePress Markdown extensions are available (containers like
`::: tip`, code groups, frontmatter for `layout: home`, etc.) — see the
[VitePress guide](https://vitepress.dev/guide/markdown).

---

## How it ships (deploy)

No separate pipeline. The existing UI deploy handles it:

1. `deploy-ui.yml` runs `pnpm --filter retro-tool-ui build`. Because `build` is
   `vite build && vitepress build docs`, this produces the SPA **and** the guide
   in `retro-tool-ui/dist/` (guide under `dist/docs/`).
2. The workflow uploads `retro-tool-ui/dist` to the Azure Static Web App with
   `skip_app_build: true`, so whatever is in `dist/` ships verbatim.
3. `public/staticwebapp.config.json` lists `/docs/*` in
   `navigationFallback.exclude`, so the SWA serves the static guide files
   instead of rewriting `/docs/*` to the SPA's `index.html`.

**Build order matters:** `vite build` runs first (it empties `dist/`), *then*
`vitepress build docs` writes into `dist/docs/`. Reversing the order would let
Vite wipe the freshly built guide.

---

## Tooling notes

- **Dependencies:** `vitepress`, `vue`, and `medium-zoom` are **devDependencies**
  of `retro-tool-ui` — build-time only, never bundled into the SPA and never in
  the production dependency tree (so they don't affect `pnpm audit --prod`).
- **TypeScript:** `retro-tool-ui/tsconfig.json` excludes `docs` so the app's
  `tsc --noEmit` doesn't try to compile the VitePress config (which uses
  Vue-typed APIs). VitePress type-checks its own config at build time.
- **ESLint:** `retro-tool-ui/eslint.config.js` ignores `docs/**` for the same
  reason. Prettier still formats `.md`.
- **Git ignore:** build output lands in `dist/` (already ignored). VitePress's
  local scratch dir `docs/.vitepress/cache` is ignored too.

---

## Search

Full-text **local search** is enabled (`themeConfig.search.provider: 'local'`
in `config.ts`). The index is built at compile time and shipped as static JSON —
no external service or API key. The search box appears in the top nav; no extra
setup is needed when adding pages (they're indexed automatically on build).

## Sections

Each feature has its own top-level section with an overview page plus several
task pages, all with real screenshots. Current sections (all under
`retro-tool-ui/docs/`), by page count (including the overview):

| Section | Path | Pages |
| --- | --- | --- |
| Retrospectives | `/retrospectives/` | 9 |
| Story Estimates | `/story-estimates/` | 8 |
| Standups | `/standups/` | 7 |
| Icebreakers | `/icebreakers/` | 6 |
| Surveys | `/surveys/` | 6 |
| Polls | `/polls/` | 5 |

To add pages within a section, drop `.md` files in that folder and add them to
the section's `sidebar` array in `config.ts`.

## Roadmap / follow-ups

- **Content:** all six sections are fully written (overview + task pages) with
  real screenshots.
- **Screenshots:** step-by-step tutorials use screenshots captured with the
  Playwright MCP, saved under `docs/public/<feature>/`. Most screenshots have
  an annotated counterpart (`<name>-annotated.png`) produced with the Image
  Annotator MCP; both the raw and annotated files are kept side by side.
- **Not planned now:** versioned docs and i18n.
