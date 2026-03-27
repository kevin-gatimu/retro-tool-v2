import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { ORG_MEMBER_ROLES } from '../../common/enums';
import { orgMemberRoleEnum } from '../../common/schema-enums';

export const organization = pgTable('organization', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logo: varchar('logo', { length: 2048 }),
  ownerId: varchar('owner_id', { length: 255 })
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export const organizationMember = pgTable('organization_member', {
  id: varchar('id', { length: 255 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 255 })
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: orgMemberRoleEnum('role').notNull().default(ORG_MEMBER_ROLES.Member),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});
