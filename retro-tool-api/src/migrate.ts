import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import * as path from 'path';
import * as fs from 'fs';

type MigrationJournal = {
  entries: Array<{ tag: string }>;
};

function isPgError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

// PostgreSQL error codes that mean "this DDL already happened" — safe to skip
const IDEMPOTENT_PG_CODES = new Set([
  '42P07', // relation already exists
  '42701', // column already exists
  '42P06', // schema already exists
  '42710', // object already exists (index, constraint, etc.)
]);

function shouldSkipStatementError(statement: string, err: unknown): boolean {
  if (!isPgError(err)) {
    return false;
  }

  if (IDEMPOTENT_PG_CODES.has(err.code)) {
    return true;
  }

  // `undefined_object` can be safe for DROP statements, but is not safe for
  // CREATE/ALTER ADD statements because it can mask missing enum/table issues.
  if (err.code === '42704') {
    return /^\s*drop\b/i.test(statement);
  }

  return false;
}

function shouldUseSsl(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  const requiresSslByHost = lower.includes('.postgres.database.azure.com');
  const requiresSslByParam =
    lower.includes('ssl=true') ||
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full');

  const isLocalConnection =
    lower.includes('@localhost:') ||
    lower.includes('@127.0.0.1:') ||
    lower.includes('@[::1]:');

  // In production, prefer TLS by default for any non-local DB.
  if (process.env.NODE_ENV === 'production' && !isLocalConnection) {
    return true;
  }

  return requiresSslByHost || requiresSslByParam;
}

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT
    )
  `);
}

async function getAppliedHashes(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ hash: string }>(
    'SELECT hash FROM "__drizzle_migrations" ORDER BY id',
  );
  return new Set(result.rows.map((r) => r.hash));
}

async function markApplied(client: PoolClient, hash: string) {
  await client.query(
    'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING',
    [hash, Date.now()],
  );
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl)
      ? {
          // Managed Postgres providers often require TLS with non-public CA chains.
          rejectUnauthorized: false,
        }
      : false,
  });

  const client = await pool.connect();

  try {
    const journalPath = path.join(
      process.cwd(),
      'drizzle',
      'meta',
      '_journal.json',
    );
    const journal = JSON.parse(
      fs.readFileSync(journalPath, 'utf-8'),
    ) as MigrationJournal;
    const entries = journal.entries;

    await ensureMigrationsTable(client);
    const applied = await getAppliedHashes(client);

    let skipped = 0;
    let ran = 0;

    console.log('Running database migrations...');

    for (const entry of entries) {
      const sqlFile = path.join(process.cwd(), 'drizzle', `${entry.tag}.sql`);
      // Use the tag as the stable hash identifier
      const hash = entry.tag;

      if (applied.has(hash)) {
        console.log(`  ✓ ${entry.tag} (already applied)`);
        skipped++;
        continue;
      }

      const sql = fs.readFileSync(sqlFile, 'utf-8');
      // Drizzle separates statements with ---> statement-breakpoint
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      console.log(`  → ${entry.tag} (${statements.length} statements)`);

      let stmtSkipped = 0;
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (err: unknown) {
          if (shouldSkipStatementError(stmt, err)) {
            console.warn(
              `    ⚠ skipped (${(err as { code?: string }).code ?? 'unknown'}): ${stmt.slice(0, 80).replace(/\n/g, ' ')}…`,
            );
            stmtSkipped++;
          } else {
            // Real error — fail fast so data-integrity issues aren't silently ignored
            throw err;
          }
        }
      }

      await markApplied(client, hash);
      ran++;
      if (stmtSkipped > 0) {
        console.log(
          `    (${stmtSkipped} statement(s) skipped — already applied)`,
        );
      }
    }

    console.log(
      `\nMigrations complete. Applied: ${ran}, Already up-to-date: ${skipped}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
