# Release & branch strategy

> How branches map to environments, how conventional commits drive automated versioning, and how GitHub Actions wire those together to deploy staging automatically while requiring a manual trigger for production.

---

## Branch model

Three long-lived branches each map 1:1 to an Azure environment.

| Branch | Environment | Resource group | Deploy trigger |
|---|---|---|---|
| `main` | Production | `retrotool-prod-rg` | **Manual** — `workflow_dispatch` only (no automated prod deploy exists) |
| `staging` | Staging | `retrotool-staging-rg` | Automatic on push (path-filtered) or `workflow_dispatch` via `release-staging.yml` |
| `develop` | *(not a deployed environment)* | *(none — never provisioned)* | No deploy workflow exists, and there is no Azure environment to deploy to |
| *(local)* | — | Docker Compose | `pnpm local:up` / `pnpm local:dev` |

> Infrastructure is provisioned separately with Azure CLI + Bicep and is **never** deployed by CI. See [../infra/provisioning.md](../infra/provisioning.md).
>
> **`develop` has no Azure footprint.** `infra/main.bicep` accepts `environment=develop` as a
> parameter value, but nobody has ever run it — there is no `retrotool-develop-rg`, ACR, Postgres
> server, App Service, Static Web App, or Convex deployment for it. All `develop`-branch work
> happens locally, same as the `*(local)*` row above.

### Intended promotion flow

```
feature-branch → PR → develop → PR → staging → PR → main
                  |               |               |
                  CI gate         CI gate         CI gate
                                  |
                                  staging auto-deploy fires
```

1. Open a PR targeting the appropriate branch.
2. CI (`ci.yml`) must pass on the PR (lint + type-check + test + build + `pnpm audit --prod --audit-level high`).
3. Merge to `develop` for integration testing. There is no deployed `develop` environment — this
   step happens entirely on each developer's local stack (`pnpm local:up`, or `pnpm dev:api` /
   `pnpm dev:ui` / `pnpm dev:convex` against local infra).
4. Promote to `staging` — the `release-staging.yml` workflow fires automatically on merge.
5. When staging is validated, promote to `main`. On `main`, release-please maintains the release PR; merging that PR bumps versions and creates the tag. Deploying to production requires a separate manual `workflow_dispatch`.

---

## Versioning & releases

### release-please (lockstep monorepo)

Versioning is automated by [release-please](https://github.com/googleapis/release-please), configured in [`release-please-config.json`](../../release-please-config.json) and driven by the [`release-please.yml`](../../.github/workflows/release-please.yml) workflow.

On every push to `main`, release-please parses the conventional-commit history and maintains a rolling "release PR" titled `chore: release v${version}`. Merging that PR:

1. Bumps every `package.json` `version` field in lockstep (via the `linked-versions` plugin — see below).
2. Updates `CHANGELOG.md`.
3. Creates a git tag `vX.Y.Z`.
4. Creates the GitHub Release.

### Packages tracked (five)

| Package path | Component name | Tag behaviour |
|---|---|---|
| `.` | `retro-tool` | `include-component-in-tag: false` — root tag is bare `vX.Y.Z` |
| `retro-tool-api` | `retro-tool-api` | Tagged `retro-tool-api-vX.Y.Z` |
| `retro-tool-ui` | `retro-tool-ui` | Tagged `retro-tool-ui-vX.Y.Z` |
| `convex-backend` | `convex-backend` | Tagged `convex-backend-vX.Y.Z` |
| `packages/shared/contracts` | `contracts` | Tagged `contracts-vX.Y.Z` |

### Lockstep via linked-versions

The `linked-versions` plugin groups all five components under the group name `retro-tool`. Every package version moves together — a `fix:` commit in any package bumps every package's patch version simultaneously.

**Current version (all packages):** `1.0.0`

### Conventional commit → version bump

| Commit type | Bump |
|---|---|
| `fix:` | patch (`1.0.0` → `1.0.1`) |
| `feat:` | minor (`1.0.0` → `1.1.0`) |
| `feat!:` or `BREAKING CHANGE:` footer | major (`1.0.0` → `2.0.0`) |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:` | none (changelog entry only) |

---

## Conventional Commits

All commits to release-target branches must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. The commit-msg hook (commitlint) enforces this locally.

Breaking changes use either the `!` shorthand or a `BREAKING CHANGE:` footer:

```
feat!: remove legacy Socket.IO retro fallback

BREAKING CHANGE: VITE_RETROS_REALTIME_BACKEND=socket-io is no longer supported
```

Full conventions, commit-type rules, and the no-`wip`-on-main rule are in [../guidelines/coding-guidelines.md](../guidelines/coding-guidelines.md) (§9 Versioning & releases).

**Commit trailer rule (non-negotiable):** never add a `Co-Authored-By: Claude` or any AI co-author trailer. Commits are authored solely under the repo owner's git identity. See [`CLAUDE.md`](../../CLAUDE.md).

---

## Deployment triggers

### Workflow summary

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR targeting `develop`, `staging`, or `main`; also `workflow_dispatch` | `pnpm audit --prod --audit-level high`, lint, type-check, test, build for all packages. Concurrency: cancel-in-progress per branch. |
| `release-please.yml` | Push to `main` | Maintains the rolling release PR; on merge bumps all `package.json` versions, updates `CHANGELOG.md`, creates `vX.Y.Z` tag, creates GitHub Release. **Does not deploy anything.** |
| `release-staging.yml` | Push to `staging` (path-filtered) or `workflow_dispatch` | Chains the three deploy workflows in order: `deploy-convex` → `deploy-api` → `deploy-ui`. |
| `deploy-convex.yml` | `workflow_call` (from `release-staging`) or `workflow_dispatch` | Validates Bicep + Convex functions, deploys self-hosted Convex App Service to **staging**, deploys Convex functions. Stop-first upgrade if image is changing (exports a backup first). Hardcodes `environment: staging` — has no production path. |
| `deploy-api.yml` | `workflow_call` or `workflow_dispatch` | Validates + type-checks API, builds + pushes Docker image to ACR (tagged `<env>-<sha>`, `<env>-latest`, `<env>-v<version>`), runs DB migrations, runs idempotent seeds, deploys container to App Service, health-checks. A `set-env` job picks `environment: production` when `github.ref_name == 'main'`, otherwise `environment: staging` — the same reusable workflow serves both, but nothing triggers it automatically on `main`. |
| `deploy-ui.yml` | `workflow_call` or `workflow_dispatch` | Validates + type-checks UI, builds Vite with baked-in `VITE_*` env vars, deploys to Azure Static Web App. Same branch-based `set-env` logic as `deploy-api.yml` (`production` on `main`, else `staging`), triggered manually. |
| `deploy-convex-production.yml` | `workflow_dispatch` only | Dedicated production-only counterpart to `deploy-convex.yml` (which is staging-hardcoded). Validates Bicep + Convex functions, deploys the self-hosted Convex App Service (`retrotool-prod-convex`) from `infra/convex-production.bicep`, stop-first upgrade if the image is changing. Targets the `production` GitHub environment. |

### Keeping the audit gate green — pnpm workspace overrides

When a transitive dependency contains a High/Critical advisory and the direct dep author hasn't released a fix yet, the standard remediation is to add a version floor to the `overrides:` block in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml). pnpm resolves **every** instance of that package to at least the floor version, regardless of what the direct dep declares. The overrides block carries a comment for each entry explaining why it exists and what constraint to revisit.

**Current active overrides (as of 2026-07-19):**

| Package | Floor | Reason |
|---|---|---|
| `better-auth` | `>=1.6.13` | Security advisory in earlier versions |
| `@better-auth/passkey` | `>=1.6.13` | Must stay in lockstep with `better-auth` or passkey client type augmentation breaks |
| `@better-auth/core` | `>=1.6.13` | Same lockstep requirement |
| `multer` | `>=2.2.0` | Security advisory in earlier versions |
| `undici` | `>=7.28.0 <8` | Security advisory; capped at `<8` — undici 8 removed internals that jsdom 28 requires, which breaks the vitest/jsdom pool |
| `kysely` | `>=0.28.17` | Security advisory in earlier versions |
| `fast-uri` | `>=3.1.2` | Security advisory in earlier versions |
| `ws` | `>=8.21.0` | Security advisory in earlier versions |

When direct dependencies advance past these floors, the corresponding override entries should be dropped.

### Staging deploy chain (`release-staging.yml`)

```mermaid
flowchart LR
    push["push to staging\n(path-filtered)\nor workflow_dispatch"]
    convex["deploy-convex\n(validate Bicep + functions,\nstop-first if image changes,\ndeploy functions)"]
    api["deploy-api\n(validate, build image,\nmigrate DB, seed,\ndeploy container,\nhealth-check)"]
    ui["deploy-ui\n(validate, Vite build,\nStatic Web App deploy)"]
    push --> convex --> api --> ui
```

- Concurrency group `staging-release`, `cancel-in-progress: false` — queued deploys run in order, never cancelled mid-deploy.
- Authentication uses OIDC (`id-token: write`) — no stored Azure credentials; federated identity credentials are configured per GitHub environment.
- Secrets are inherited from the `staging` GitHub environment.

### Path filter (staging auto-deploy)

`release-staging.yml` only fires if the push touches:

```
convex-backend/**
infra/**
packages/shared/contracts/**
retro-tool-api/**
retro-tool-ui/**
.github/workflows/deploy-api.yml
.github/workflows/deploy-convex.yml
.github/workflows/deploy-ui.yml
.github/workflows/release-staging.yml
```

Documentation-only commits to `staging` do not trigger a deploy.

### Production deploy — manual only, mechanics differ by component

There is no automated (push-triggered) production release pipeline — no `release-production.yml` exists to chain deploys the way `release-staging.yml` does for staging. How each component's production path works differs:

- **API and UI** (`deploy-api.yml`, `deploy-ui.yml`): the `set-env` job picks `environment: production` when `github.ref_name == 'main'`, else `environment: staging` — the same reusable workflow serves both environments and correctly targets the `production` GitHub environment when dispatched from `main`. Nothing triggers this automatically; it requires a manual `workflow_dispatch` from the `main` branch.
- **Convex** (`deploy-convex.yml`): hardcodes `environment: staging` unconditionally — it has no production path at all. Production Convex is deployed by a separate, dedicated workflow, [`deploy-convex-production.yml`](../../.github/workflows/deploy-convex-production.yml), which is `workflow_dispatch`-only and deploys against `infra/convex-production.bicep`.

**To deploy production today:** trigger `deploy-api.yml` and `deploy-ui.yml` via `workflow_dispatch` from the `main` branch (each auto-selects the `production` environment), and trigger `deploy-convex-production.yml` via `workflow_dispatch` separately for Convex. All three require the `production` GitHub environment's secrets/variables to be configured.

This remains a known gap: production deploys are manual and opt-in for every component, and there is still no `release-production.yml` equivalent to `release-staging.yml` to chain them.

### API image tagging

`deploy-api.yml` tags the Docker image three ways on each build:

| Tag | Example | Purpose |
|---|---|---|
| `<env>-<sha8>` | `staging-a1b2c3d4` | Unique per commit — used as the actual deploy tag |
| `<env>-latest` | `staging-latest` | Floating pointer for quick reference |
| `<env>-v<version>` | `staging-v1.0.0` | Human-readable release tag; enables `v1.1.0 → v1.0.3` rollbacks |

The `<version>` is read from `retro-tool-api/package.json` at build time, so after a release-please bump the version tag is accurate.

---

## Related docs

| Doc | What it covers |
|---|---|
| [../infra/provisioning.md](../infra/provisioning.md) | Bicep provisioning walkthrough, environment→branch mapping, GitHub environment setup, self-hosted Convex |
| [../infra/oidc.md](../infra/oidc.md) | OIDC federated-credential setup for GitHub Actions |
| [../architecture/overview.md](../architecture/overview.md) | Azure topology table (env → branch → resource group → service names) |
| [../workflows/running-the-app.md](../workflows/running-the-app.md) | Running locally, against staging, and against production |
| [../guidelines/coding-guidelines.md](../guidelines/coding-guidelines.md) | §9 Versioning & releases — conventional commit rules, commitlint config, no-wip-on-main |
| [`../../.github/workflows/release-please.yml`](../../.github/workflows/release-please.yml) | Release-please workflow source |
| [`../../.github/workflows/release-staging.yml`](../../.github/workflows/release-staging.yml) | Staging deploy chain source |
| [`../../release-please-config.json`](../../release-please-config.json) | Packages, components, linked-versions config |
