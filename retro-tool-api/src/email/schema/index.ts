import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { EMAIL_LOG_STATUSES } from '../../common/enums';
import {
  emailLogStatusEnum,
  emailLogTypeEnum,
} from '../../common/schema-enums';

// ============================================================================
// Email Log Table
// ============================================================================

export const emailLog = pgTable(
  'email_log',
  {
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
  },
  (table) => [
    index('email_log_user_id_idx').on(table.userId),
    index('email_log_type_idx').on(table.type),
    index('email_log_status_idx').on(table.status),
    index('email_log_user_type_idx').on(table.userId, table.type),
    index('email_log_created_at_idx').on(table.createdAt),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
