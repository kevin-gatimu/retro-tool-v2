import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { organization } from '../../organizations/schema';
import { user } from '../../auth/schema';
import {
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
} from '../../common/enums';
import {
  teamJoinRequestStatusEnum,
  teamMemberTagEnum,
} from '../../common/schema-enums';

// Team role catalog (built-in global roles + org-custom roles)
export const teamRole = pgTable(
  'team_role',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    isBuiltIn: boolean('is_built_in').notNull().default(false),
    orgId: varchar('org_id', { length: 255 }).references(
      () => organization.id,
      { onDelete: 'cascade' },
    ),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_role_org_id_idx').on(table.orgId),
    uniqueIndex('team_role_org_name_unique').on(table.orgId, table.name),
  ],
);

// Per-org activation overrides for built-in roles
export const orgTeamRoleConfig = pgTable(
  'org_team_role_config',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 })
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    teamRoleId: varchar('team_role_id', { length: 255 })
      .notNull()
      .references(() => teamRole.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    unique().on(t.orgId, t.teamRoleId),
    index('org_team_role_config_org_id_idx').on(t.orgId),
    index('org_team_role_config_team_role_id_idx').on(t.teamRoleId),
  ],
);

// Team table definition
export const team = pgTable(
  'team',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    emoji: varchar('emoji', { length: 100 }).default('👥'),
    organizationId: varchar('organization_id', { length: 255 })
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_organization_id_idx').on(table.organizationId),
    index('team_created_at_idx').on(table.createdAt),
    uniqueIndex('team_org_name_unique').on(table.organizationId, table.name),
  ],
);

// Team member table definition
export const teamMember = pgTable(
  'team_member',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: varchar('role_id', { length: 255 }).references(() => teamRole.id, {
      onDelete: 'set null',
    }),
    tag: teamMemberTagEnum('tag').notNull().default(TEAM_MEMBER_TAGS.Member),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_member_team_id_idx').on(table.teamId),
    index('team_member_user_id_idx').on(table.userId),
    index('team_member_role_id_idx').on(table.roleId),
    index('team_member_tag_idx').on(table.tag),
    uniqueIndex('team_member_team_user_unique').on(table.teamId, table.userId),
  ],
);

// Team join request table definition
export const teamJoinRequest = pgTable(
  'team_join_request',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: teamJoinRequestStatusEnum('status')
      .notNull()
      .default(TEAM_JOIN_REQUEST_STATUSES.Pending),
    message: text('message'),
    reviewedById: varchar('reviewed_by_id', { length: 255 }).references(
      () => user.id,
    ),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_join_request_team_id_idx').on(table.teamId),
    index('team_join_request_user_id_idx').on(table.userId),
    index('team_join_request_status_idx').on(table.status),
    index('team_join_request_team_user_status_idx').on(
      table.teamId,
      table.userId,
      table.status,
    ),
  ],
);

// Team invitation table
export const teamInvitation = pgTable(
  'team_invitation',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    tag: teamMemberTagEnum('tag').notNull().default(TEAM_MEMBER_TAGS.Member),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_invitation_team_id_idx').on(table.teamId),
    index('team_invitation_email_idx').on(table.email),
    index('team_invitation_created_by_id_idx').on(table.createdById),
  ],
);

// Type definitions for team-related entities
export type TeamRole = typeof teamRole.$inferSelect;
export type NewTeamRole = typeof teamRole.$inferInsert;

export type OrgTeamRoleConfig = typeof orgTeamRoleConfig.$inferSelect;
export type NewOrgTeamRoleConfig = typeof orgTeamRoleConfig.$inferInsert;

export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;

export type TeamMember = typeof teamMember.$inferSelect;
export type NewTeamMember = typeof teamMember.$inferInsert;

export type TeamInvitation = typeof teamInvitation.$inferSelect;
export type NewTeamInvitation = typeof teamInvitation.$inferInsert;
