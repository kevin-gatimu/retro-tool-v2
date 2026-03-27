// Re-export session-related tables from auth schema
export { session } from '../../auth/schema';

// Type definitions for session-related entities
import { session } from '../../auth/schema';
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
