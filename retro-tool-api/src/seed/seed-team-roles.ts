/**
 * Production-safe team roles seeding script.
 * Seeds all built-in team roles — idempotent and safe to run in any environment.
 *
 * Run locally:  pnpm db:seed:roles
 */
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '../../.env'), override: true });
loadDotenv({ path: join(__dirname, '../../.env.local'), override: true });
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { teamRole } from '../teams/schema';
import { BUILT_IN_TEAM_ROLES } from '../common/data/built-in-team-roles';

async function seedTeamRoles() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log('Seeding built-in team roles...');

  const existing = await db
    .select({ name: teamRole.name })
    .from(teamRole)
    .where(eq(teamRole.isBuiltIn, true));

  const existingNames = new Set(existing.map((r) => r.name));

  let added = 0;
  const now = new Date();

  for (const role of BUILT_IN_TEAM_ROLES) {
    if (existingNames.has(role.name)) {
      continue;
    }

    await db.insert(teamRole).values({
      id: randomUUID(),
      name: role.name,
      isBuiltIn: true,
      orgId: null,
      isActive: true,
      sortOrder: role.sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  Added "${role.name}"`);
    added++;
  }

  if (added > 0) {
    console.log(`✅ Added ${added} new team role(s)`);
  } else {
    console.log('✅ All team roles already exist, nothing to add');
  }

  await pool.end();
}

seedTeamRoles().catch((err) => {
  console.error('Team role seeding failed:', err);
  process.exit(1);
});
