import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { EMAIL_LOG_STATUSES } from '../../common/enums';
import {
  emailLogStatusEnum,
  emailLogTypeEnum,
} from '../../common/schema-enums';

// ============================================================================
// Email Log Table
// ============================================================================

export const emailLog = pgTable('email_log', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: emailLogTypeEnum('type').notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  htmlBody: text('html_body').notNull(),
  status: emailLogStatusEnum('status')
    .notNull()
    .default(EMAIL_LOG_STATUSES.Sent),
  sentAt: timestamp('sent_at'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// Type definitions
// ============================================================================

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
