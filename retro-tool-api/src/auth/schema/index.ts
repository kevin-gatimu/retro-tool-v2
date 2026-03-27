import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { USER_ROLES, USER_STATUSES } from '../../common/enums';
import {
  adminActionLogActionEnum,
  userRoleEnum,
  userStatusEnum,
} from '../../common/schema-enums';

export { userRoleEnum, userStatusEnum };

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  role: userRoleEnum('role').notNull().default(USER_ROLES.Member),
  status: userStatusEnum('status').notNull().default(USER_STATUSES.Pending),
  bio: text('bio'),
  lastActiveAt: timestamp('last_active_at'),
  approvedAt: timestamp('approved_at'),
  approvedById: text('approved_by_id'),
  suspendedAt: timestamp('suspended_at'),
  suspendedById: text('suspended_by_id'),
  suspendedReason: text('suspended_reason'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const adminActionLog = pgTable('admin_action_log', {
  id: varchar('id', { length: 255 }).primaryKey(),
  adminId: text('admin_id')
    .notNull()
    .references(() => user.id),
  targetUserId: text('target_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  action: adminActionLogActionEnum('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});
