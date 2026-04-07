import 'dotenv/config';
import { Pool } from 'pg';

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

  if (process.env.NODE_ENV === 'production' && !isLocalConnection) {
    return true;
  }

  return requiresSslByHost || requiresSslByParam;
}

function deriveConvexDatabaseName(): string {
  const explicit = process.env.CONVEX_DATABASE_NAME?.trim();
  if (explicit) {
    return explicit;
  }

  const instanceName = process.env.CONVEX_INSTANCE_NAME?.trim();
  if (instanceName) {
    return instanceName.toLowerCase().replace(/-/g, '_');
  }

  return 'convex_local';
}

function validateDatabaseName(name: string): string {
  // Keep this strict to avoid SQL injection through identifier interpolation.
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid Convex database name '${name}'. Use lowercase letters, digits, and underscores only.`,
    );
  }
  return name;
}

function quoteIdentifier(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function ensureConvexDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const targetDb = validateDatabaseName(deriveConvexDatabaseName());

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl)
      ? {
          rejectUnauthorized: false,
        }
      : false,
  });

  const client = await pool.connect();

  try {
    const exists = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [targetDb],
    );

    if (exists.rows[0]?.exists) {
      console.log(`Convex database '${targetDb}' already exists.`);
      return;
    }

    const createSql = `CREATE DATABASE ${quoteIdentifier(targetDb)}`;
    await client.query(createSql);
    console.log(`Created Convex database '${targetDb}'.`);
  } finally {
    client.release();
    await pool.end();
  }
}

ensureConvexDatabase().catch((err: unknown) => {
  console.error('Failed to ensure Convex database:', err);
  process.exit(1);
});
