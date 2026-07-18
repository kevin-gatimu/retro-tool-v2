#!/usr/bin/env node
/**
 * Projection load-test burst driver (dependency-free, Node 22+).
 *
 * Signs in as the load-test fixture owner, then fires a sustained burst of retro
 * mutations (card creates) at a target rate for a fixed duration. Each mutation
 * triggers the per-member board fan-out, so with a large seeded team this is the
 * write amplification the Tier-1 changes are meant to absorb.
 *
 * This measures the CLIENT-observed side (request rate, latency, error rate).
 * Run docker/loadtest/watch-outbox.mjs alongside it to watch queue depth/lag,
 * and `docker stats` on the Convex container for worker CPU.
 *
 * Prereqs:
 *   1. Stack up with the load-test override (constrained Convex) — see README.
 *   2. `pnpm --dir retro-tool-api db:seed:templates && db:seed:load`
 *
 * Usage:
 *   API=http://localhost:8000 RETRO_ID=<id> \
 *     node docker/loadtest/burst.mjs --rate 40 --duration 60
 *
 * Flags (or env): --rate (req/s, default 20), --duration (s, default 30),
 * --email (default loadtest-owner@example.com), --password (default "password").
 */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API = (process.env.API ?? 'http://localhost:8000').replace(/\/$/, '');
const RETRO_ID = process.env.RETRO_ID ?? arg('retro', '');
const RATE = Number(arg('rate', process.env.RATE ?? '20'));
const DURATION_S = Number(arg('duration', process.env.DURATION ?? '30'));
const EMAIL = arg('email', process.env.EMAIL ?? 'loadtest-owner@example.com');
const PASSWORD = arg('password', process.env.PASSWORD ?? 'password');

if (!RETRO_ID) {
  console.error('RETRO_ID is required (from `db:seed:load` output).');
  process.exit(1);
}

async function signIn() {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  }
  const token = res.headers.get('set-auth-token');
  if (!token) throw new Error('no set-auth-token header on sign-in response');
  return token;
}

const latencies = [];
let ok = 0;
let failed = 0;

async function oneMutation(token, n) {
  const start = performance.now();
  try {
    const res = await fetch(`${API}/api/retros/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        retroId: RETRO_ID,
        columnId: null,
        content: `load-test card ${n} @ ${Date.now()}`,
      }),
    });
    if (res.ok) ok += 1;
    else failed += 1;
  } catch {
    failed += 1;
  } finally {
    latencies.push(performance.now() - start);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

async function main() {
  console.log(
    `Burst: ${RATE} req/s for ${DURATION_S}s against retro ${RETRO_ID} @ ${API}`,
  );
  const token = await signIn();

  const intervalMs = 1000 / RATE;
  const totalReqs = RATE * DURATION_S;
  const inFlight = new Set();
  const startedAt = performance.now();

  for (let n = 0; n < totalReqs; n += 1) {
    const p = oneMutation(token, n).finally(() => inFlight.delete(p));
    inFlight.add(p);
    // Pace requests without waiting for responses (open-model load).
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  await Promise.all(inFlight);

  const wallS = (performance.now() - startedAt) / 1000;
  latencies.sort((a, b) => a - b);
  console.log('\n─── Client-observed results ───');
  console.log(`requests      : ${ok + failed} (${ok} ok, ${failed} failed)`);
  console.log(`wall time     : ${wallS.toFixed(1)}s`);
  console.log(`achieved rate : ${((ok + failed) / wallS).toFixed(1)} req/s`);
  console.log(`latency p50   : ${percentile(latencies, 50)} ms`);
  console.log(`latency p90   : ${percentile(latencies, 90)} ms`);
  console.log(`latency p99   : ${percentile(latencies, 99)} ms`);
  console.log(
    '\nNow check: watch-outbox.mjs for queue drain, `docker stats` for Convex CPU.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
