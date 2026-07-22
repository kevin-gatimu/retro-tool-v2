#!/usr/bin/env node
/**
 * Parameterized DB task runner.
 *
 * Replaces the previous copy-pasted per-environment script chains in package.json
 * (each of which rebuilt the app and repeated the same dotenv/node incantation),
 * so a step added to a task can never drift between local, staging, and prod.
 *
 * Usage: node scripts/db.mjs <task> [env]
 *   task  migrate | ensure-convex | seed | seed:templates |
 *         seed:icebreaker-templates | seed:roles | seed:users |
 *         seed:large-org | seed:prod-safe
 *   env   local (default) | staging | prod
 *
 * local        → runs the TypeScript sources via ts-node against .env.local
 * staging/prod → builds once, then runs the compiled dist/ output with
 *                dotenv preloading .env.<staging|production>-local
 */
import { execSync } from 'node:child_process';
import process from 'node:process';

const SEED_TEMPLATES = [
  'seed/seed-retro-templates',
  'seed/seed-estimate-templates',
  'seed/seed-icebreaker-templates',
];

/**
 * steps        — entry modules under src/ (no extension), run in order.
 * remoteExtras — steps prepended only for staging/prod (e.g. Convex DB bootstrap
 *                before migrations, matching the previous scripts' behavior).
 * localOnly    — tasks that must never run against remote environments.
 */
const TASKS = {
  migrate: { steps: ['migrate'], remoteExtras: ['ensure-convex-database'] },
  'ensure-convex': { steps: ['ensure-convex-database'] },
  seed: {
    steps: [...SEED_TEMPLATES, 'seed/seed-team-roles', 'seed/seed-users'],
    localOnly: true, // demo users must never be seeded remotely
  },
  'seed:templates': { steps: SEED_TEMPLATES },
  'seed:icebreaker-templates': { steps: ['seed/seed-icebreaker-templates'] },
  'seed:roles': { steps: ['seed/seed-team-roles'], localOnly: true },
  'seed:users': { steps: ['seed/seed-users'], localOnly: true },
  'seed:large-org': { steps: ['seed/seed-large-org'], localOnly: true },
  'seed:load': { steps: ['seed/seed-load-test'], localOnly: true },
  // Everything safe to run against shared environments (templates + roles).
  'seed:prod-safe': { steps: [...SEED_TEMPLATES, 'seed/seed-team-roles'] },
};

const ENV_FILES = {
  staging: '.env.staging-local',
  prod: '.env.production-local',
};

const [taskName, envName = 'local'] = process.argv.slice(2);
const task = TASKS[taskName];

if (!task) {
  console.error(
    `Unknown task "${taskName ?? ''}". Tasks: ${Object.keys(TASKS).join(', ')}`,
  );
  process.exit(1);
}
if (envName !== 'local' && !ENV_FILES[envName]) {
  console.error(`Unknown env "${envName}". Envs: local, staging, prod`);
  process.exit(1);
}
if (envName !== 'local' && task.localOnly) {
  console.error(`Task "${taskName}" is local-only and cannot target ${envName}.`);
  process.exit(1);
}

const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit' });
};

if (envName === 'local') {
  // Always compile against tsconfig.build.json: it sets rootDir=./src, which
  // ts-node needs when a step lives in a subdirectory (e.g. src/seed/*) —
  // otherwise TS infers the common source dir as that subdir and errors (TS5011).
  for (const step of task.steps) {
    run(`ts-node --project tsconfig.build.json --transpile-only src/${step}.ts`);
  }
} else {
  const envFile = ENV_FILES[envName];
  const steps = [...(task.remoteExtras ?? []), ...task.steps];
  run('pnpm build'); // build once, not once per step
  for (const step of steps) {
    run(`node -r dotenv/config dist/${step}.js dotenv_config_path=${envFile}`);
  }
}
