/**
 * Focused load-test seed — NOT for production.
 *
 * Creates ONE org with ONE team of N members (default 50; override with
 * LOADTEST_TEAM_SIZE) plus an active retro owned by that team. This is the
 * fixture for measuring projection fan-out under a write burst: every mutation
 * on the retro re-projects a board snapshot PER member, so the team size is the
 * fan-out multiplier under test.
 *
 * Run against the LOCAL stack only (requires `db:seed:templates` first):
 *   LOADTEST_TEAM_SIZE=50 pnpm --dir retro-tool-api db:seed:load
 *
 * Prints the created retroId, teamId and a sign-in email so the burst driver
 * (docker/loadtest/burst.mjs) can target them. All users share the password
 * `password`. Idempotent: re-running reuses the fixture if present.
 */
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '../../.env'), override: false });
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { user, account } from '../auth/schema';
import { organization, organizationMember } from '../organizations/schema';
import { team, teamMember } from '../teams/schema';
import { retrospective, template } from '../retros/schema';

// Hash of hashPassword("password"), reused across seed scripts.
const TEST_PASSWORD_HASH =
  'da771cb3adb80ba3908959c427dd6afd:493676568b25b1005b89afd6b7f04f832d2013e164975888eb2cfdf89b69ebf0cf07ea8dadc934fc42a6382c54ee182c4c8261bec83e31bb612cd7ea6017f511';

// Standalone seed script — no NestJS app context, so ConfigService is
// unavailable; reading process.env directly is the only option here.
const TEAM_SIZE = Number(process.env.LOADTEST_TEAM_SIZE ?? '50');
const ORG_NAME = 'Load Test Org';
const TEAM_NAME = 'Load Test Team';
const OWNER_EMAIL = 'loadtest-owner@example.com';

function uid(): string {
  return randomUUID();
}

async function main(): Promise<void> {
  if (!Number.isInteger(TEAM_SIZE) || TEAM_SIZE < 1 || TEAM_SIZE > 5_000) {
    throw new Error(`LOADTEST_TEAM_SIZE must be 1–5000, got ${TEAM_SIZE}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const [existingOrg] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, ORG_NAME))
      .limit(1);

    if (existingOrg) {
      const [existingRetro] = await db
        .select({ id: retrospective.id })
        .from(retrospective)
        .where(eq(retrospective.name, 'Load Test Retro'))
        .limit(1);
      console.log('Load-test fixture already exists. Reusing.');
      console.log(
        JSON.stringify(
          {
            orgId: existingOrg.id,
            retroId: existingRetro?.id ?? null,
            ownerEmail: OWNER_EMAIL,
            password: 'password',
          },
          null,
          2,
        ),
      );
      return;
    }

    // A retro requires a template FK. Reuse any seeded template (run
    // `pnpm db:seed:templates` first if this is empty).
    const [seededTemplate] = await db
      .select({ id: template.id })
      .from(template)
      .limit(1);
    if (!seededTemplate) {
      throw new Error(
        'No retro template found — run `pnpm --dir retro-tool-api db:seed:templates` first.',
      );
    }

    console.log(`Seeding load-test fixture: 1 team × ${TEAM_SIZE} members…`);

    const orgId = uid();
    const teamId = uid();
    const ownerId = uid();

    // Owner
    const nowTs = new Date();
    await db.insert(user).values({
      id: ownerId,
      email: OWNER_EMAIL,
      name: 'Load Test Owner',
      emailVerified: true,
      status: 'approved',
      role: 'member',
      createdAt: nowTs,
      updatedAt: nowTs,
    });
    await db.insert(account).values({
      id: uid(),
      accountId: ownerId,
      providerId: 'credential',
      userId: ownerId,
      password: TEST_PASSWORD_HASH,
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    await db.insert(organization).values({
      id: orgId,
      name: ORG_NAME,
      slug: `load-test-org-${orgId.slice(0, 8)}`,
      ownerId,
    });
    await db.insert(organizationMember).values({
      id: uid(),
      organizationId: orgId,
      userId: ownerId,
      role: 'org-owner',
    });
    await db.insert(team).values({
      id: teamId,
      name: TEAM_NAME,
      organizationId: orgId,
    });
    await db.insert(teamMember).values({
      id: uid(),
      teamId,
      userId: ownerId,
      tag: 'team-lead',
    });

    // N-1 additional members (owner is already one member of the team).
    const members: (typeof user.$inferInsert)[] = [];
    const accounts: (typeof account.$inferInsert)[] = [];
    const teamMembers: (typeof teamMember.$inferInsert)[] = [];
    for (let i = 1; i < TEAM_SIZE; i += 1) {
      const memberId = uid();
      members.push({
        id: memberId,
        email: `loadtest-member-${i}@example.com`,
        name: `Load Test Member ${i}`,
        emailVerified: true,
        status: 'approved',
        role: 'member',
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      accounts.push({
        id: uid(),
        accountId: memberId,
        providerId: 'credential',
        userId: memberId,
        password: TEST_PASSWORD_HASH,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      teamMembers.push({
        id: uid(),
        teamId,
        userId: memberId,
        tag: 'member',
      });
    }
    // Chunk inserts to stay under parameter limits.
    const CHUNK = 500;
    for (let i = 0; i < members.length; i += CHUNK) {
      await db.insert(user).values(members.slice(i, i + CHUNK));
      await db.insert(account).values(accounts.slice(i, i + CHUNK));
      await db.insert(teamMember).values(teamMembers.slice(i, i + CHUNK));
    }

    // An active retro to hammer (cards/votes/comments trigger the fan-out).
    const retroId = uid();
    await db.insert(retrospective).values({
      id: retroId,
      name: 'Load Test Retro',
      teamId,
      templateId: seededTemplate.id,
      createdById: ownerId,
      status: 'active',
    });

    console.log('Load-test fixture created.');
    console.log(
      JSON.stringify(
        {
          orgId,
          teamId,
          retroId,
          ownerEmail: OWNER_EMAIL,
          password: 'password',
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
