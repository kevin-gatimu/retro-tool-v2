/**
 * Enterprise-scale seed script — NOT for production.
 *
 * Creates 70 organizations, each with 50 teams and 300 members per team.
 *
 * Per org  : 1 owner  +  3 org-admins  +  50 × 300 team members = 15,004 users
 * Per team : 4 team-leads  +  296 regular members  (all get a job role)
 * Total    : ~1,050,280 users, 3,500 teams, ~1,050,000 team memberships
 *
 * Run: pnpm db:seed:large-org
 *
 * Prerequisites: run pnpm db:migrate first.
 *
 * Password for all seeded users: password
 *
 * NOTE: This script will take 15–30 minutes to complete.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { user, account } from '../auth/schema';
import { organization, organizationMember } from '../organizations/schema';
import { team, teamMember } from '../teams/schema';
import { TEAM_MEMBER_ROLES } from '../common/enums';

// Hash generated from: hashPassword("password") — reused for all seed users.
const TEST_PASSWORD_HASH =
  'da771cb3adb80ba3908959c427dd6afd:493676568b25b1005b89afd6b7f04f832d2013e164975888eb2cfdf89b69ebf0cf07ea8dadc934fc42a6382c54ee182c4c8261bec83e31bb612cd7ea6017f511';

// ── Configuration ─────────────────────────────────────────────────────────────

const ORG_COUNT = 70;
const TEAMS_PER_ORG = 50;
const MEMBERS_PER_TEAM = 300;
const TEAM_LEADS_PER_TEAM = 4;
const ORG_ADMINS_PER_ORG = 3;
// Round-robin job roles for all team members
const ROLE_VALUES = Object.values(TEAM_MEMBER_ROLES);

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return randomUUID();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Idempotency check — skip if first org already exists
  const [existing] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.name, 'Enterprise Org 1'))
    .limit(1);

  if (existing) {
    console.log('"Enterprise Org 1" already exists. Skipping.');
    await pool.end();
    return;
  }

  console.log(
    `Seeding ${ORG_COUNT} orgs × ${TEAMS_PER_ORG} teams × ${MEMBERS_PER_TEAM} members…`,
  );
  console.log(
    `Expected totals: ~${(ORG_COUNT * (1 + ORG_ADMINS_PER_ORG + TEAMS_PER_ORG * MEMBERS_PER_TEAM)).toLocaleString()} users, ${(ORG_COUNT * TEAMS_PER_ORG).toLocaleString()} teams`,
  );
  console.log('This may take 15–30 minutes.\n');

  const startTime = Date.now();

  for (let orgIdx = 1; orgIdx <= ORG_COUNT; orgIdx++) {
    console.log(`Creating Enterprise Org ${orgIdx}/${ORG_COUNT} …`);

    const orgId = uid();

    // ── Owner ───────────────────────────────────────────────────────────────
    const ownerUserId = uid();

    await db.insert(user).values({
      id: ownerUserId,
      name: `Ent${orgIdx} Owner`,
      email: `ent-${orgIdx}-owner@example.com`,
      emailVerified: true,
      role: 'member' as const,
      status: 'approved' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
    });
    await db.insert(account).values({
      id: uid(),
      userId: ownerUserId,
      accountId: ownerUserId,
      providerId: 'credential',
      password: TEST_PASSWORD_HASH,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ── Org admins ──────────────────────────────────────────────────────────
    const adminUserIds: string[] = [];
    const adminUsers: (typeof user.$inferInsert)[] = [];
    const adminAccounts: (typeof account.$inferInsert)[] = [];

    for (let a = 1; a <= ORG_ADMINS_PER_ORG; a++) {
      const id = uid();
      adminUserIds.push(id);
      adminUsers.push({
        id,
        name: `Ent${orgIdx} Admin${a}`,
        email: `ent-${orgIdx}-admin-${a}@example.com`,
        emailVerified: true,
        role: 'member' as const,
        status: 'approved' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
      });
      adminAccounts.push({
        id: uid(),
        userId: id,
        accountId: id,
        providerId: 'credential',
        password: TEST_PASSWORD_HASH,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.insert(user).values(adminUsers);
    await db.insert(account).values(adminAccounts);

    // ── Organization ────────────────────────────────────────────────────────
    await db.insert(organization).values({
      id: orgId,
      name: `Enterprise Org ${orgIdx}`,
      slug: `enterprise-org-${orgIdx}`,
      ownerId: ownerUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Org memberships for owner + admins
    const specialOrgMembers: (typeof organizationMember.$inferInsert)[] = [
      {
        id: uid(),
        userId: ownerUserId,
        organizationId: orgId,
        role: 'org-owner' as const,
        createdAt: new Date(),
      },
      ...adminUserIds.map((adminId) => ({
        id: uid(),
        userId: adminId,
        organizationId: orgId,
        role: 'org-admin' as const,
        createdAt: new Date(),
      })),
    ];
    await db.insert(organizationMember).values(specialOrgMembers);

    // ── Teams ───────────────────────────────────────────────────────────────
    for (let teamIdx = 1; teamIdx <= TEAMS_PER_ORG; teamIdx++) {
      const teamId = uid();

      await db.insert(team).values({
        id: teamId,
        name: `Team ${teamIdx}`,
        organizationId: orgId,
        description: `Auto-generated team ${teamIdx} for Enterprise Org ${orgIdx}`,
        emoji: '👥',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const teamUsers: (typeof user.$inferInsert)[] = [];
      const teamAccounts: (typeof account.$inferInsert)[] = [];
      const teamOrgMembers: (typeof organizationMember.$inferInsert)[] = [];
      const teamMembers: (typeof teamMember.$inferInsert)[] = [];

      for (let memberIdx = 0; memberIdx < MEMBERS_PER_TEAM; memberIdx++) {
        const userId = uid();
        const isLead = memberIdx < TEAM_LEADS_PER_TEAM;
        const jobRole = ROLE_VALUES[memberIdx % ROLE_VALUES.length];

        teamUsers.push({
          id: userId,
          name: `Ent${orgIdx} T${teamIdx} User${memberIdx + 1}`,
          email: `ent-${orgIdx}-t${teamIdx}-${memberIdx + 1}@example.com`,
          emailVerified: true,
          role: 'member' as const,
          status: 'approved' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null,
        });

        teamAccounts.push({
          id: uid(),
          userId,
          accountId: userId,
          providerId: 'credential',
          password: TEST_PASSWORD_HASH,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        teamOrgMembers.push({
          id: uid(),
          userId,
          organizationId: orgId,
          role: 'member' as const,
          createdAt: new Date(),
        });

        teamMembers.push({
          id: uid(),
          userId,
          teamId,
          tag: isLead ? ('team-lead' as const) : ('member' as const),
          role: jobRole,
          createdAt: new Date(),
        });
      }

      await db.insert(user).values(teamUsers);
      await db.insert(account).values(teamAccounts);
      await db.insert(organizationMember).values(teamOrgMembers);
      await db.insert(teamMember).values(teamMembers);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `  Org ${orgIdx}/${ORG_COUNT} done — ${TEAMS_PER_ORG} teams, ${TEAMS_PER_ORG * MEMBERS_PER_TEAM} team members (${elapsed}s elapsed)`,
    );
  }

  const totalSeconds = Math.round((Date.now() - startTime) / 1000);
  const totalUsers =
    ORG_COUNT * (1 + ORG_ADMINS_PER_ORG + TEAMS_PER_ORG * MEMBERS_PER_TEAM);

  console.log(`\nDone in ${totalSeconds}s!`);
  console.log(`  Organizations : ${ORG_COUNT}`);
  console.log(`  Teams         : ${ORG_COUNT * TEAMS_PER_ORG}`);
  console.log(`  Users         : ${totalUsers.toLocaleString()}`);
  console.log(
    `  Team members  : ${(ORG_COUNT * TEAMS_PER_ORG * MEMBERS_PER_TEAM).toLocaleString()}`,
  );
  console.log(`  Password for all: password`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
