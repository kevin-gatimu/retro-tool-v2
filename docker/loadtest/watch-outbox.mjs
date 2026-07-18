#!/usr/bin/env node
/**
 * Projection outbox watcher for load tests. Polls the projection_outbox table
 * once a second and prints pending/failed counts + oldest-pending age, so you
 * can watch the queue build during a burst and drain afterward — the key signal
 * for whether the dispatcher keeps up with the fan-out.
 *
 * Uses DATABASE_URL from retro-tool-api/.env.local by default.
 *
 * Usage:
 *   node docker/loadtest/watch-outbox.mjs
 *   DATABASE_URL=postgres://… node docker/loadtest/watch-outbox.mjs
 *
 * Requires `pg` (already a dependency of retro-tool-api); run from repo root.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Pool } = require('../../retro-tool-api/node_modules/pg');

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync('retro-tool-api/.env.local', 'utf8');
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* fall through */
  }
  throw new Error('Set DATABASE_URL or provide retro-tool-api/.env.local');
}

const pool = new Pool({ connectionString: resolveDatabaseUrl() });

let peakPending = 0;

async function tick() {
  const { rows } = await pool.query(`
    SELECT
      count(*) FILTER (WHERE status = 'pending')                    AS pending,
      count(*) FILTER (WHERE status = 'failed')                     AS failed,
      count(*) FILTER (WHERE status = 'dispatched')                 AS dispatched,
      EXTRACT(EPOCH FROM (now() - min(created_at)
        FILTER (WHERE status = 'pending'))) * 1000                  AS oldest_ms
    FROM projection_outbox
  `);
  const r = rows[0];
  const pending = Number(r.pending);
  peakPending = Math.max(peakPending, pending);
  const oldest = r.oldest_ms == null ? '—' : `${Math.round(r.oldest_ms)}ms`;
  const stamp = new Date().toISOString().slice(11, 19);
  process.stdout.write(
    `\r[${stamp}] pending=${pending} (peak ${peakPending})  failed=${r.failed}  dispatched=${r.dispatched}  oldest=${oldest}      `,
  );
}

console.log('Watching projection_outbox (Ctrl-C to stop)…');
const timer = setInterval(() => {
  tick().catch((err) => {
    console.error('\n', err.message);
  });
}, 1000);

process.on('SIGINT', () => {
  clearInterval(timer);
  console.log(`\nPeak pending during run: ${peakPending}`);
  void pool.end().then(() => process.exit(0));
});
