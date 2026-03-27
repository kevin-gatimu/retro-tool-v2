import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { organization } from '../../organizations/schema';
import { user } from '../../auth/schema';
import {
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
} from '../../common/enums';
import {
  teamJoinRequestStatusEnum,
  teamMemberRoleEnum,
  teamMemberTagEnum,
} from '../../common/schema-enums';

// Team table definition
export const team = pgTable('team', {
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
});

// Team member table definition
export const teamMember = pgTable('team_member', {
  id: varchar('id', { length: 255 }).primaryKey(),
  teamId: varchar('team_id', { length: 255 })
    .notNull()
    .references(() => team.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: teamMemberRoleEnum('role'),
  tag: teamMemberTagEnum('tag').notNull().default(TEAM_MEMBER_TAGS.Member),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

// Team join request table definition
export const teamJoinRequest = pgTable('team_join_request', {
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
});

// Type definitions for team-related entities
export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;

export type TeamMember = typeof teamMember.$inferSelect;
export type NewTeamMember = typeof teamMember.$inferInsert;
