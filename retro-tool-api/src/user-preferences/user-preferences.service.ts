import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { UserPreferencesDto, UpdateUserPreferencesDto } from './dto';
import { generateId } from '../lib/utils';

type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class UserPreferencesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
  ) {}

  // ============================================================================
  // Get User Preferences
  // ============================================================================

  async getUserPreferences(userId: string): Promise<UserPreferencesDto> {
    const prefs =
      await this.database.query.userNotificationPreference.findFirst({
        where: eq(schema.userNotificationPreference.userId, userId),
      });

    if (!prefs) {
      // Create default preferences if they don't exist
      await this.createDefaultPreferences(userId);
      // Recursive call will now find the created preferences
      return this.getUserPreferences(userId);
    }

    return {
      emailVerificationReminders: prefs.emailVerificationReminders,
      weeklyDigestEnabled: prefs.weeklyDigestEnabled,
      weeklyDigestDay: prefs.weeklyDigestDay,
      retrospectiveRemindersEnabled: prefs.retrospectiveRemindersEnabled,
      retrospectiveReminderHours: prefs.retrospectiveReminderHours,
      teamActivityEmailsEnabled: prefs.teamActivityEmailsEnabled,
    };
  }

  // ============================================================================
  // Create Default Preferences
  // ============================================================================

  async createDefaultPreferences(userId: string): Promise<void> {
    try {
      await this.database.insert(schema.userNotificationPreference).values({
        id: generateId(),
        userId,
        emailVerificationReminders: true,
        weeklyDigestEnabled: true,
        weeklyDigestDay: 'monday',
        retrospectiveRemindersEnabled: true,
        retrospectiveReminderHours: 24,
        teamActivityEmailsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      // Ignore unique constraint errors (race condition with another create)
      if (
        error instanceof Error &&
        !error.message.includes('UNIQUE constraint failed')
      ) {
        throw error;
      }
    }
  }

  // ============================================================================
  // Update User Preferences
  // ============================================================================

  async updateUserPreferences(
    userId: string,
    updates: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    // Ensure preferences exist
    const existing =
      await this.database.query.userNotificationPreference.findFirst({
        where: eq(schema.userNotificationPreference.userId, userId),
      });

    if (!existing) {
      await this.createDefaultPreferences(userId);
    }

    // Update preferences
    await this.database
      .update(schema.userNotificationPreference)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.userNotificationPreference.userId, userId));

    // Return updated preferences
    return this.getUserPreferences(userId);
  }
}
