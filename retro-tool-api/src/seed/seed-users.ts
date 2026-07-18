/**
 * Development seed script — NOT for production.
 * Seeds demo users, organisations, and teams.
 *
 * Run: pnpm db:seed:users
 *
 * Prerequisites: run pnpm db:migrate first.
 *
 * Password for all seeded users: password
 */
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '../../.env'), override: true });
loadDotenv({ path: join(__dirname, '../../.env.local'), override: true });
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { user, account } from '../auth/schema';
import { organization, organizationMember } from '../organizations/schema';
import { team, teamMember } from '../teams/schema';

// Hash generated from: import { hashPassword } from "better-auth/crypto"; hashPassword("password")
const TEST_PASSWORD_HASH =
  'da771cb3adb80ba3908959c427dd6afd:493676568b25b1005b89afd6b7f04f832d2013e164975888eb2cfdf89b69ebf0cf07ea8dadc934fc42a6382c54ee182c4c8261bec83e31bb612cd7ea6017f511';

// ── UUID constants ────────────────────────────────────────────────────────────
// All IDs use real v4-format UUIDs so NestJS @IsUUID() validation passes.

// Users  (prefix 10...)
const UID = {
  superAdmin: 'c0323e5f-9969-4b78-8b63-71d2c53f5cef',
  admin1: 'a69f5432-7535-4f98-918b-fcaf37b65ae0',
  admin2: 'c7fbdaa9-e9e1-4d0f-9490-27cef3ce3274',
  member1: '7a1f0981-b7fe-420b-a84c-615e0ade7831',
  member2: 'dc368efe-0ba5-44ea-95f3-2595bba6d079',
  member3: '6496c999-fb36-4b62-8b03-23a3e6d98527',
  member4: '0f5377ea-3694-4302-b456-e97dacd42fe3',
  member5: '5b59265e-cc74-4bda-b10b-e006e81989b3',
  feActive1: '0b616d60-0e93-4dc5-a3e4-d3ace6c86115',
  feActive2: '0a058168-ad6d-448d-bf4f-fa2a1b370fa0',
  feSusp1: 'b19242e2-4077-4fed-81a4-8db6eb633ca7',
  feSusp2: 'dd12b038-872c-4ba5-b08e-c63c2aa0a50a',
  beActive1: 'f657cbbe-7463-40f7-93f6-c0a08e10a77e',
  beActive2: '520284a4-20f9-4edd-9e99-245fc1bd32d7',
  beSusp1: 'd747224a-1897-43d2-8487-01d30c0ca6a9',
  beSusp2: '903b91a4-9ed1-46e0-a917-b0916ea54ff3',
  mbActive1: '264d1ea0-9534-4869-b1d0-7b372c2005e5',
  mbActive2: '5ad124d5-c833-4029-a54a-1606a864ba96',
  mbSusp1: 'a6a51af0-73fa-42d5-9863-b2960b3927a5',
  mbSusp2: '489c1718-9076-472a-9bc8-e0c08dc6d027',
  pending1: '4b3e7ce5-289e-4c11-8aa9-d2fda7e19dfc',
  pending2: '36c8ab30-b980-4596-b4d2-31d6d63abf73',
  suspended1: 'b5f0eba4-e8bc-43f7-9292-530d70f4013e',
} as const;

// Accounts (prefix 20...)
const AID = {
  superAdmin: 'd2e1ad1e-229d-4f07-8a0b-164f14dfa5ef',
  admin1: '84e40cfb-138e-4201-9e47-44953ad87524',
  admin2: 'c42cae1a-0507-47e8-8463-3cec018aaa92',
  member1: 'bfa7e6b4-cf79-4dec-8e07-01adbdf26e0d',
  member2: 'fb808935-1ce3-4172-9921-db43bab58089',
  member3: 'ed1fcd8a-d507-4952-903e-8f7a0fcdd73e',
  member4: '60735547-c53d-45d2-95bf-0244ae914c96',
  member5: '9e258167-35b4-4adb-b03a-6e17f40ada3d',
  feActive1: 'acbeeaca-0260-4056-9484-d0f514056da1',
  feActive2: 'cf9ce0e0-a87c-45ce-a304-51458b83ea61',
  feSusp1: '786c2276-e049-477b-a31b-b10108b1db0e',
  feSusp2: '32200f59-736b-4f35-9949-f1deeb650c7f',
  beActive1: '9ad74dcd-4a29-42ce-8942-8a2979747c27',
  beActive2: 'b83aa725-9a27-40a3-a37e-5a7bbf650968',
  beSusp1: '2e350c08-bd3d-425c-a221-32429b872540',
  beSusp2: '5c054605-a51c-4afd-860f-0a9345e5a41a',
  mbActive1: 'd466eb82-907a-42ff-9701-427051c870fa',
  mbActive2: '4ee6787c-2b25-4a9e-ae05-dfd42d4346c2',
  mbSusp1: '226eba3a-c7ea-4368-9c5b-f96d9822a816',
  mbSusp2: 'f1d02338-1f31-4b2b-af4f-f50d91d55a07',
  pending1: '3ec34767-5d64-4663-b22c-7d30d69eabf2',
  pending2: '8000084d-92a9-4d99-9f38-78805a57ccc8',
  suspended1: '581136a8-8cb5-47ad-9979-42c75d281a53',
} as const;

// Organizations (prefix 30...)
const OID = {
  acme: '43a0930a-0d7e-4322-ba2e-ad3fdfa917c8',
  techco: '45423219-80c8-4ff7-b319-1246b90d8e7c',
} as const;

// Organization Members (prefix 40...)
const OMID = {
  super1: '7e0cc1b0-98e8-42a7-8332-9ce78917d762',
  super2: '7694ed2d-9e4b-4474-9d2e-c914067eead1',
  m1: '82a0c7cd-f84e-46e7-8200-119173108e47',
  m2: 'f79c59a5-e66f-45e3-8812-fc235fd76113',
  m3: '3018b674-93d1-4968-8c36-012308db46a2',
  m4: '4c07ee1a-0b7e-47b2-a812-3091b11ab212',
  m5: '4f2c567b-411b-4449-a958-032c3a22de87',
  m6: '7f007e79-bab5-4194-bb8b-ac3f834ad9b5',
  m7: 'd465db03-449a-4b85-8bd3-d997738ce102',
  m8: '1dfe392b-d851-40f8-bb25-8b53332bca94',
  m9: '1e15081e-48c1-471f-bcb9-477f4cedcb11',
  m10: '9d189a41-56a6-4019-b321-29110ddf51e4',
  m11: '4f7c8e93-33c9-4ebf-adcb-e6d8d97f4c3b',
  m12: '96921961-99fb-444c-a9c0-a94b78856a59',
  m13: '3bf85b0d-b168-4415-bfd6-b1c3787596e5',
  m14: 'f9412c58-591e-4458-99b6-41f52ac742dd',
  m15: 'db98b7d0-b2be-4ffd-95d1-cea0df94549d',
  m16: '4638fd26-4946-4054-a895-1ef2290aa085',
  m17: '65d18a0b-3d99-4652-9777-f388c6af7a80',
  m18: '6e5320a2-1191-404b-9ba9-9559e4eba7d7',
} as const;

// Teams (prefix 50...)
const TID = {
  frontend: 'bb527039-c5a9-4913-a7a8-1ccd6731ad35',
  backend: 'e5b28011-5752-4f2b-8d9d-9325ef399024',
  mobile: '64c97008-40b1-477e-8372-5b656e565242',
} as const;

// Team Members (prefix 60...)
const TMID = {
  super1: '4bce760a-91c5-461e-b0ab-bd7007700815',
  super2: '3b19997d-0563-4cb5-bd05-f194e9e100cc',
  super3: '77ae70f2-9a0c-4e0b-8e3f-dd519e1e318d',
  m1: 'da5381ab-3550-4a66-8398-b8c7361f57fc',
  m2: '6461736b-d5d6-4abd-878a-a0b6fd133a8a',
  m3: '45c4dfad-4bed-45e7-bdd3-a661021b8e33',
  m4: 'b59a775c-41d2-487c-83e7-fa0b05fd88c7',
  m5: '773b562b-c852-453d-b2ca-7f16288358be',
  m6: 'c584104c-db52-4d4d-add8-f111636bdfe1',
  m7: '37fcf827-b57d-4a6a-afad-f998e7d98876',
  m8: 'a72dfafe-c289-45b1-a489-44e04e6c58cf',
  m9: '29f947c9-a987-4d83-b90a-078a26743576',
  m10: '6141ac38-234d-481d-848a-5b7ab63715e3',
  m11: 'edfd81ab-a638-4d0a-a741-938e8b266d1d',
  m12: '57d5d61f-083e-4033-8f15-ce22ab5ca6f9',
  m13: 'a2ee7a11-96cc-4fde-a169-2f167cbdb486',
  m14: '007a8c25-4c68-4093-a379-eaa3cade91ed',
  m15: '8463549f-53dc-44c2-89a7-e07f594aa663',
  m16: '05167d91-31df-468c-85ad-f97d763ff144',
  m17: 'a7863110-ed80-414d-92bb-06045e1521fa',
  m18: 'a35b331c-89cd-4039-9f3e-7aa5f3840906',
} as const;

// ── Database connection ──────────────────────────────────────────────────────

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool), pool };
}

// ── Seed: Users ──────────────────────────────────────────────────────────────

async function seedUsers(db: ReturnType<typeof drizzle>) {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, 'charlie@example.com'))
    .limit(1);
  if (existing.length > 0) {
    console.log('Users already seeded, skipping...');
    return;
  }

  console.log('Seeding users...');
  const now = new Date();

  const users: Array<{
    id: string;
    accountId: string;
    name: string;
    email: string;
    role: 'super-admin' | 'system-admin' | 'org-admin' | 'team-lead' | 'member';
    status: 'approved' | 'pending' | 'suspended';
  }> = [
    // Super admin
    {
      id: UID.superAdmin,
      accountId: AID.superAdmin,
      name: 'Super Admin',
      email: 'admin@example.com',
      role: 'super-admin',
      status: 'approved',
    },
    // System admins
    {
      id: UID.admin1,
      accountId: AID.admin1,
      name: 'Alice Admin',
      email: 'alice@example.com',
      role: 'system-admin',
      status: 'approved',
    },
    {
      id: UID.admin2,
      accountId: AID.admin2,
      name: 'Bob Admin',
      email: 'bob@example.com',
      role: 'system-admin',
      status: 'approved',
    },
    // Approved members — org owners / team leads
    {
      id: UID.member1,
      accountId: AID.member1,
      name: 'Charlie Member',
      email: 'charlie@example.com',
      role: 'org-admin',
      status: 'approved',
    },
    {
      id: UID.member2,
      accountId: AID.member2,
      name: 'Diana Developer',
      email: 'diana@example.com',
      role: 'org-admin',
      status: 'approved',
    },
    {
      id: UID.member3,
      accountId: AID.member3,
      name: 'Eve Engineer',
      email: 'eve@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.member4,
      accountId: AID.member4,
      name: 'Frank Frontend',
      email: 'frank@example.com',
      role: 'org-admin',
      status: 'approved',
    },
    {
      id: UID.member5,
      accountId: AID.member5,
      name: 'Grace Backend',
      email: 'grace@example.com',
      role: 'team-lead',
      status: 'approved',
    },
    // Additional frontend team members
    {
      id: UID.feActive1,
      accountId: AID.feActive1,
      name: 'Liam Frontend',
      email: 'liam@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.feActive2,
      accountId: AID.feActive2,
      name: 'Mia Frontend',
      email: 'mia@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.feSusp1,
      accountId: AID.feSusp1,
      name: 'Noah Suspended',
      email: 'noah@example.com',
      role: 'member',
      status: 'suspended',
    },
    {
      id: UID.feSusp2,
      accountId: AID.feSusp2,
      name: 'Olivia Suspended',
      email: 'olivia@example.com',
      role: 'member',
      status: 'suspended',
    },
    // Additional backend team members
    {
      id: UID.beActive1,
      accountId: AID.beActive1,
      name: 'Peter Backend',
      email: 'peter@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.beActive2,
      accountId: AID.beActive2,
      name: 'Quinn Backend',
      email: 'quinn@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.beSusp1,
      accountId: AID.beSusp1,
      name: 'Ryan Suspended',
      email: 'ryan@example.com',
      role: 'member',
      status: 'suspended',
    },
    {
      id: UID.beSusp2,
      accountId: AID.beSusp2,
      name: 'Sophie Suspended',
      email: 'sophie@example.com',
      role: 'member',
      status: 'suspended',
    },
    // Additional mobile team members
    {
      id: UID.mbActive1,
      accountId: AID.mbActive1,
      name: 'Tom Mobile',
      email: 'tom@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.mbActive2,
      accountId: AID.mbActive2,
      name: 'Uma Mobile',
      email: 'uma@example.com',
      role: 'member',
      status: 'approved',
    },
    {
      id: UID.mbSusp1,
      accountId: AID.mbSusp1,
      name: 'Victor Suspended',
      email: 'victor@example.com',
      role: 'member',
      status: 'suspended',
    },
    {
      id: UID.mbSusp2,
      accountId: AID.mbSusp2,
      name: 'Wendy Suspended',
      email: 'wendy@example.com',
      role: 'member',
      status: 'suspended',
    },
    // Pending users
    {
      id: UID.pending1,
      accountId: AID.pending1,
      name: 'Henry Pending',
      email: 'henry@example.com',
      role: 'member',
      status: 'pending',
    },
    {
      id: UID.pending2,
      accountId: AID.pending2,
      name: 'Ivy Pending',
      email: 'ivy@example.com',
      role: 'member',
      status: 'pending',
    },
    // Standalone suspended
    {
      id: UID.suspended1,
      accountId: AID.suspended1,
      name: 'Jack Suspended',
      email: 'jack@example.com',
      role: 'member',
      status: 'suspended',
    },
  ];

  await db
    .insert(user)
    .values(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        approvedAt: u.status === 'approved' ? now : null,
        suspendedAt: u.status === 'suspended' ? now : null,
        suspendedReason:
          u.status === 'suspended' ? 'Violated terms of service' : null,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(account)
    .values(
      users.map((u) => ({
        id: u.accountId,
        userId: u.id,
        accountId: u.id, // credential provider uses userId as accountId
        providerId: 'credential',
        password: TEST_PASSWORD_HASH,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();

  console.log('✅ Users seeded (password: password)');
  console.log('   admin@example.com — Super Admin (super-admin)');
  console.log(
    '   alice@example.com, bob@example.com — System Admins (system-admin)',
  );
  console.log(
    '   charlie@example.com, diana@example.com, frank@example.com — Org Admins (org-admin)',
  );
  console.log('   grace@example.com — Team Lead (team-lead)');
  console.log('   eve@example.com … uma@example.com — Members (member)');
}

// ── Seed: Organisations & Teams ──────────────────────────────────────────────

async function seedOrganizationsAndTeams(db: ReturnType<typeof drizzle>) {
  const existing = await db.select().from(organization).limit(1);
  if (existing.length > 0) {
    console.log('Organisations already seeded, skipping...');
    return;
  }

  console.log('Seeding organisations and teams...');
  const now = new Date();

  await db.insert(organization).values([
    {
      id: OID.acme,
      name: 'Acme Corporation',
      slug: 'acme',
      ownerId: UID.member1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: OID.techco,
      name: 'TechCo Inc',
      slug: 'techco',
      ownerId: UID.member4,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(organizationMember).values([
    // Super admin is in both orgs
    {
      id: OMID.super1,
      organizationId: OID.acme,
      userId: UID.superAdmin,
      role: 'org-admin' as const,
      createdAt: now,
    },
    {
      id: OMID.super2,
      organizationId: OID.techco,
      userId: UID.superAdmin,
      role: 'org-admin' as const,
      createdAt: now,
    },
    // Acme
    {
      id: OMID.m1,
      organizationId: OID.acme,
      userId: UID.member1,
      role: 'org-owner' as const,
      createdAt: now,
    },
    {
      id: OMID.m2,
      organizationId: OID.acme,
      userId: UID.member2,
      role: 'org-admin' as const,
      createdAt: now,
    },
    {
      id: OMID.m3,
      organizationId: OID.acme,
      userId: UID.member3,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m4,
      organizationId: OID.acme,
      userId: UID.member5,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m7,
      organizationId: OID.acme,
      userId: UID.feActive1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m8,
      organizationId: OID.acme,
      userId: UID.feActive2,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m9,
      organizationId: OID.acme,
      userId: UID.feSusp1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m10,
      organizationId: OID.acme,
      userId: UID.feSusp2,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m11,
      organizationId: OID.acme,
      userId: UID.beActive1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m12,
      organizationId: OID.acme,
      userId: UID.beActive2,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m13,
      organizationId: OID.acme,
      userId: UID.beSusp1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m14,
      organizationId: OID.acme,
      userId: UID.beSusp2,
      role: 'member' as const,
      createdAt: now,
    },
    // TechCo
    {
      id: OMID.m5,
      organizationId: OID.techco,
      userId: UID.member4,
      role: 'org-owner' as const,
      createdAt: now,
    },
    {
      id: OMID.m6,
      organizationId: OID.techco,
      userId: UID.member2,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m15,
      organizationId: OID.techco,
      userId: UID.mbActive1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m16,
      organizationId: OID.techco,
      userId: UID.mbActive2,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m17,
      organizationId: OID.techco,
      userId: UID.mbSusp1,
      role: 'member' as const,
      createdAt: now,
    },
    {
      id: OMID.m18,
      organizationId: OID.techco,
      userId: UID.mbSusp2,
      role: 'member' as const,
      createdAt: now,
    },
  ]);

  await db.insert(team).values([
    {
      id: TID.frontend,
      name: 'Frontend Team',
      description: 'Building beautiful user interfaces',
      emoji: '🎨',
      organizationId: OID.acme,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: TID.backend,
      name: 'Backend Team',
      description: 'APIs and infrastructure',
      emoji: '⚙️',
      organizationId: OID.acme,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: TID.mobile,
      name: 'Mobile Team',
      description: 'iOS and Android development',
      emoji: '📱',
      organizationId: OID.techco,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(teamMember).values([
    // Super admin is in all teams
    {
      id: TMID.super1,
      teamId: TID.frontend,
      userId: UID.superAdmin,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.super2,
      teamId: TID.backend,
      userId: UID.superAdmin,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.super3,
      teamId: TID.mobile,
      userId: UID.superAdmin,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    // Frontend team
    {
      id: TMID.m1,
      teamId: TID.frontend,
      userId: UID.member2,
      tag: 'team-lead' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m2,
      teamId: TID.frontend,
      userId: UID.member3,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m7,
      teamId: TID.frontend,
      userId: UID.feActive1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m8,
      teamId: TID.frontend,
      userId: UID.feActive2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m9,
      teamId: TID.frontend,
      userId: UID.feSusp1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m10,
      teamId: TID.frontend,
      userId: UID.feSusp2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    // Backend team
    {
      id: TMID.m3,
      teamId: TID.backend,
      userId: UID.member5,
      tag: 'team-lead' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m4,
      teamId: TID.backend,
      userId: UID.member1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m11,
      teamId: TID.backend,
      userId: UID.beActive1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m12,
      teamId: TID.backend,
      userId: UID.beActive2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m13,
      teamId: TID.backend,
      userId: UID.beSusp1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m14,
      teamId: TID.backend,
      userId: UID.beSusp2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    // Mobile team
    {
      id: TMID.m5,
      teamId: TID.mobile,
      userId: UID.member4,
      tag: 'team-lead' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m6,
      teamId: TID.mobile,
      userId: UID.member2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m15,
      teamId: TID.mobile,
      userId: UID.mbActive1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m16,
      teamId: TID.mobile,
      userId: UID.mbActive2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m17,
      teamId: TID.mobile,
      userId: UID.mbSusp1,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
    {
      id: TMID.m18,
      teamId: TID.mobile,
      userId: UID.mbSusp2,
      tag: 'member' as const,
      roleId: null,
      createdAt: now,
    },
  ]);

  console.log('✅ Organisations and teams seeded');
  console.log('   Acme Corporation: Frontend Team, Backend Team');
  console.log('   TechCo Inc: Mobile Team');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { db, pool } = createDb();

  try {
    await seedUsers(db);
    await seedOrganizationsAndTeams(db);
    console.log('');
    console.log('🎉 Dev seed complete!');
    console.log('   Users/orgs/teams seeded.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
