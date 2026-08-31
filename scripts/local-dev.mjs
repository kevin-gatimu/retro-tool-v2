#!/usr/bin/env node
/**
 * One-command local bootstrap for the full self-hosted stack.
 *
 * Brings up PostgreSQL + the self-hosted Convex backend (+ dashboard) in Docker,
 * derives the Convex admin key from the running container, writes it into the
 * API `.env` and Convex `.env.local` files, runs DB migrations + seeds, and
 * deploys the Convex functions. After this, `pnpm local:dev` runs the API, UI,
 * and Convex watcher natively against the Docker infra.
 *
 * Idempotent: safe to re-run. Usage:
 *   node scripts/local-dev.mjs            # full bootstrap
 *   node scripts/local-dev.mjs --no-seed  # skip demo seeding
 *   node scripts/local-dev.mjs --reset    # tear volumes down first (clean slate)
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE = ['-f', join(root, 'docker/docker-compose.local.yml')];
const ENV_FILE = join(root, 'docker/.env');
const CONVEX_CONTAINER = 'retro-tool-local-convex-backend-1';
const CONVEX_URL = 'http://localhost:3210';

const args = new Set(process.argv.slice(2));
const skipSeed = args.has('--no-seed');
const reset = args.has('--reset');

const log = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);

const sh = (command, opts = {}) => {
  console.log(`  $ ${command}`);
  execSync(command, { stdio: 'inherit', cwd: root, ...opts });
};

const shCapture = (command, opts = {}) =>
  execSync(command, { cwd: root, encoding: 'utf8', ...opts }).trim();

const compose = (cmd) =>
  `docker compose --env-file "${ENV_FILE}" ${COMPOSE.map((c) => `"${c}"`).join(' ')} ${cmd}`;

// ── Preconditions ────────────────────────────────────────────────────────────

function ensureDockerRunning() {
  const res = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (res.status !== 0) {
    console.error('\x1b[31mDocker daemon is not running. Start Docker Desktop and retry.\x1b[0m');
    process.exit(1);
  }
}

function ensureEnvFiles() {
  // docker/.env drives the compose stack; each app env file drives its native
  // dev server. Seed any missing file from its committed example.
  const pairs = [
    ['docker/.env', 'docker/.env.example'],
    ['retro-tool-api/.env', 'retro-tool-api/.env.example'],
    ['retro-tool-ui/.env', 'retro-tool-ui/.env.example'],
    ['convex-backend/.env.local', 'convex-backend/.env.example'],
  ];
  for (const [target, example] of pairs) {
    const t = join(root, target);
    if (!existsSync(t)) {
      copyFileSync(join(root, example), t);
      warn(`created ${target} from ${example} — review its secrets`);
    }
  }
}

// ── Env file patching ────────────────────────────────────────────────────────

/** Set KEY=value in a dotenv file, replacing an existing line or appending. */
function setEnv(file, key, value) {
  const path = join(root, file);
  const line = `${key}=${value}`;
  let content = readFileSync(path, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(path, content);
}

// ── Steps ────────────────────────────────────────────────────────────────────

function startInfra() {
  if (reset) {
    log('Resetting Docker volumes (clean slate)');
    sh(compose('down -v'));
  }
  log('Starting Docker infra (postgres, convex-backend, convex-dashboard)');
  sh(compose('up -d postgres convex-backend convex-dashboard'));
}

/** Block ~ms milliseconds synchronously without spawning a process. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForConvex() {
  log('Waiting for Convex backend /version');
  for (let i = 0; i < 60; i += 1) {
    try {
      execSync(`curl -fsS ${CONVEX_URL}/version`, { stdio: 'ignore' });
      ok('Convex backend is serving /version');
      return;
    } catch {
      sleepSync(2000);
    }
  }
  console.error('\x1b[31mConvex /version never became ready. Check: pnpm local:logs\x1b[0m');
  process.exit(1);
}

function generateAdminKey() {
  log('Generating the Convex admin key from the running container');
  // NOT deterministic: generate_admin_key.sh mints a NEW signed token each run,
  // each independently valid (the backend accepts any key signed by its
  // INSTANCE_SECRET; new keys don't revoke old ones). We just need one valid
  // key written consistently into the env files below. Re-running bootstrap
  // therefore ROTATES the local key — restart `pnpm dev:api` afterwards so it
  // picks up the new CONVEX_SYNC_ADMIN_KEY.
  const key = shCapture(
    `docker exec ${CONVEX_CONTAINER} ./generate_admin_key.sh`,
  )
    .split('\n')
    .map((l) => l.trim())
    // The script prints a prose "Admin key:" line then the key on its own line.
    // The key is `<instanceName>|<hex...>` (older images append a base64 `=`
    // tail); the "|" separator is the reliable marker across formats.
    .filter((l) => l.includes('|') && !l.toLowerCase().includes('admin key'))
    .pop();

  if (!key) {
    console.error('\x1b[31mCould not parse an admin key from generate_admin_key.sh output.\x1b[0m');
    process.exit(1);
  }
  ok('admin key derived');
  return key;
}

function writeAdminKey(key) {
  log('Writing the admin key + local Convex config into app env files');
  // API: runtime projection pushes use the sync URL + admin key.
  setEnv('retro-tool-api/.env', 'CONVEX_SYNC_URL', CONVEX_URL);
  setEnv('retro-tool-api/.env', 'CONVEX_SYNC_ADMIN_KEY', key);
  // Convex CLI: deploy functions against the self-hosted backend.
  setEnv('convex-backend/.env.local', 'CONVEX_SELF_HOSTED_URL', 'http://127.0.0.1:3210');
  setEnv('convex-backend/.env.local', 'CONVEX_SELF_HOSTED_ADMIN_KEY', key);
  // The Convex CLI refuses to run when a Cloud deployment ref is set alongside
  // the self-hosted vars, so clear the Cloud pointers for local self-hosting.
  setEnv('convex-backend/.env.local', 'CONVEX_DEPLOYMENT', '');
  setEnv('convex-backend/.env.local', 'CONVEX_DEPLOY_KEY', '');
  ok('API .env and Convex .env.local updated');
}

const CREDS_FILE = 'convex-dashboard-login.local.txt';

/**
 * Write the Convex dashboard login creds to a root text file for easy copy-paste
 * into the dashboard at http://localhost:6791. The `.local.txt` suffix is matched
 * by the repo's `*.local` gitignore rule, so the admin key is never committed.
 * Overwritten on every bootstrap so it always reflects the current key.
 */
function writeCredsFile(key) {
  const body = `Convex dashboard login — http://localhost:6791
(auto-generated by \`pnpm local:bootstrap\`; git-ignored; regenerated every run)

Deployment URL:  ${CONVEX_URL}
Admin Key:       ${key}

This key is a signed token from INSTANCE_SECRET (docker/.env), not a fixed value:
\`pnpm local:bootstrap\` mints a NEW valid key each run and rewrites this file and
the app env files. Older keys keep working; only changing INSTANCE_SECRET (or
\`pnpm local:reset\`) invalidates them. After a re-bootstrap, restart \`pnpm dev:api\`
so it uses the refreshed key.
`;
  writeFileSync(join(root, CREDS_FILE), body);
  ok(`dashboard creds written to ${CREDS_FILE}`);
}

function migrateAndSeed() {
  log('Running database migrations');
  sh('pnpm --dir retro-tool-api db:migrate');
  ok('migrations applied');

  if (skipSeed) {
    warn('skipping seed (--no-seed)');
    return;
  }
  log('Seeding templates, roles, and demo users');
  sh('pnpm --dir retro-tool-api db:seed');
  ok('seed complete');
}

function deployConvexFunctions() {
  // The backend's convex/auth.config.ts reads these function env vars to verify
  // the API's RS256 JWTs. They are Convex *function* env (set via the CLI), not
  // container env, so `convex deploy` fails until they exist.
  //
  // Networking subtlety that breaks ALL realtime if wrong: JWT_ISSUER must match
  // the token's `iss` claim, which is the browser-facing API origin
  // (http://localhost:8000). But JWT_JWKS_URL is fetched *by the Convex backend
  // from inside its Docker container*, where `localhost` is the container, not
  // the host — so it must use host.docker.internal. Getting this wrong makes
  // Convex silently reject every token and all subscriptions fall back to REST
  // polling.
  log('Setting Convex JWT function env vars');
  const apiIssuer = 'http://localhost:8000'; // must equal token `iss`
  const jwksFromContainer = 'http://host.docker.internal:8000/api/auth/jwks';
  try {
    sh(`pnpm --dir convex-backend exec convex env set JWT_ISSUER ${apiIssuer}`);
    sh('pnpm --dir convex-backend exec convex env set JWT_AUDIENCE convex');
    sh(`pnpm --dir convex-backend exec convex env set JWT_JWKS_URL ${jwksFromContainer}`);
    ok('Convex JWT env set (JWKS via host.docker.internal for container reachability)');
  } catch {
    warn('could not set Convex JWT env — set them via `convex env set` and retry deploy');
  }

  log('Deploying Convex functions to the self-hosted backend');
  try {
    sh('pnpm --dir convex-backend exec convex deploy --yes');
    ok('Convex functions deployed');
  } catch {
    warn('convex deploy failed — run `pnpm dev:convex` to deploy in watch mode');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

ensureDockerRunning();
ensureEnvFiles();
startInfra();
waitForConvex();
const adminKey = generateAdminKey();
writeAdminKey(adminKey);
writeCredsFile(adminKey);
migrateAndSeed();
deployConvexFunctions();

console.log(`
\x1b[32m✓ Local stack is ready.\x1b[0m

  Infra (Docker):   postgres :5433 · convex :3210 · dashboard :6791
  Dashboard login:  see \x1b[36m${CREDS_FILE}\x1b[0m (Deployment URL + Admin Key)
  Next:             \x1b[36mpnpm local:dev\x1b[0m   (API :8000 · UI :3000 · Convex watcher)

  API/UI read .env; Convex reads .env.local. Stop infra with \x1b[36mpnpm local:down\x1b[0m.
`);
