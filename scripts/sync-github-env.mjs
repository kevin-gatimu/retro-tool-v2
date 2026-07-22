#!/usr/bin/env node
/**
 * Bulk-sync GitHub Actions environment secrets and variables from a single local
 * values file, so the deploy workflows' config never drifts by hand-editing one
 * key at a time (which is how CONVEX_SYNC_URL went stale).
 *
 * Source of truth:
 *   - scripts/github-env-manifest.json  — classifies every key as secret|variable
 *     (committed; no values).
 *   - .github-env.<env>.local            — KEY=VALUE lines (git-ignored; you fill it).
 *
 * The App Service is (re)configured FROM these GitHub values on every deploy, so
 * writing them here and re-running the deploy is what makes a change durable.
 * Editing App Service settings directly is transient — the next deploy overwrites it.
 *
 * Usage:
 *   node scripts/sync-github-env.mjs <env> [--dry-run] [--only KEY,KEY] [--prune]
 *   pnpm gh:env:sync staging -- --dry-run
 *
 * Flags:
 *   --dry-run     Show what would change; make no writes.
 *   --only a,b    Only sync these keys (comma-separated).
 *   --prune       Report keys set on GitHub that are absent from the values file
 *                 (never deletes automatically — only warns).
 *
 * Requires: gh CLI authenticated (`gh auth status`) with repo admin rights.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');

const args = process.argv.slice(2);
const env = args.find((a) => !a.startsWith('-'));
const dryRun = args.includes('--dry-run');
const prune = args.includes('--prune');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf('--only') + 1] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

if (!env) {
  fail('Usage: node scripts/sync-github-env.mjs <env> [--dry-run] [--only KEY,KEY] [--prune]');
}

const manifestPath = join(scriptDir, 'github-env-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (!manifest.environments.includes(env)) {
  fail(`Unknown environment "${env}". Manifest allows: ${manifest.environments.join(', ')}`);
}

const valuesPath = join(repoRoot, `.github-env.${env}.local`);
if (!existsSync(valuesPath)) {
  fail(
    `Values file not found: .github-env.${env}.local\n` +
      `Create it (git-ignored) with KEY=VALUE lines. See .github-env.example.`,
  );
}

// Parse KEY=VALUE (first '=' splits; value may contain '='; ignore #comments/blanks).
const values = new Map();
for (const raw of readFileSync(valuesPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let val = line.slice(eq + 1).trim();
  // Strip a single layer of surrounding quotes if present.
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  values.set(key, val);
}

const gh = (ghArgs, input) =>
  execFileSync('gh', ghArgs, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: repoRoot,
  });

// Confirm gh is authenticated up front for a clear error instead of N failures.
try {
  gh(['auth', 'status']);
} catch {
  fail('gh CLI is not authenticated. Run `gh auth login` first.');
}

const known = Object.keys(manifest.keys);
const toSync = (only ?? known).filter((k) => values.has(k));
const unknownRequested = (only ?? []).filter((k) => !manifest.keys[k]);
if (unknownRequested.length) {
  fail(`--only names keys not in the manifest: ${unknownRequested.join(', ')}`);
}

const missingValues = known.filter((k) => !values.has(k));

console.log(`\x1b[36mGitHub env sync → ${env}${dryRun ? '  (dry-run)' : ''}\x1b[0m`);
console.log(`  values file: .github-env.${env}.local`);
console.log(`  will sync:   ${toSync.length} key(s)\n`);

let secretsSet = 0;
let varsSet = 0;
for (const key of toSync) {
  const { kind } = manifest.keys[key];
  const value = values.get(key);
  const shown = kind === 'secret' ? '••••••••' : value;
  if (dryRun) {
    console.log(`  [dry] ${kind.padEnd(8)} ${key} = ${shown}`);
    continue;
  }
  try {
    if (kind === 'secret') {
      // Pass value on stdin so it never lands in argv / process listing.
      gh(['secret', 'set', key, '--env', env], value);
      secretsSet++;
    } else {
      gh(['variable', 'set', key, '--env', env, '--body', value]);
      varsSet++;
    }
    console.log(`  \x1b[32m✓\x1b[0m ${kind.padEnd(8)} ${key} = ${shown}`);
  } catch (err) {
    console.error(`  \x1b[31m✗ ${key}: ${err.message.split('\n')[0]}\x1b[0m`);
  }
}

if (missingValues.length) {
  console.log(
    `\n\x1b[33m⚠ ${missingValues.length} manifest key(s) have no value in the file (left untouched):\x1b[0m`,
  );
  console.log(`  ${missingValues.join(', ')}`);
}

if (prune) {
  console.log('\n\x1b[36mPrune check (report only — nothing deleted):\x1b[0m');
  const listNames = (subcmd) => {
    try {
      const out = gh([subcmd, 'list', '--env', env, '--json', 'name']);
      return JSON.parse(out).map((r) => r.name);
    } catch {
      // Older gh without --json: fall back to first column of plain output.
      const out = gh([subcmd, 'list', '--env', env]);
      return out
        .split(/\r?\n/)
        .map((l) => l.split(/\s+/)[0])
        .filter(Boolean)
        .slice(1);
    }
  };
  const remote = new Set([...listNames('secret'), ...listNames('variable')]);
  const orphaned = [...remote].filter((n) => !manifest.keys[n] && n !== 'GITHUB_TOKEN');
  if (orphaned.length) {
    console.log(`  On GitHub but not in manifest: ${orphaned.join(', ')}`);
  } else {
    console.log('  No orphaned keys.');
  }
}

if (!dryRun) {
  console.log(
    `\n\x1b[32m✓ Done: ${secretsSet} secret(s), ${varsSet} variable(s) set on "${env}".\x1b[0m`,
  );
  console.log(
    '  Re-run the deploy (push or workflow_dispatch) so App Service picks up the new values.',
  );
}
