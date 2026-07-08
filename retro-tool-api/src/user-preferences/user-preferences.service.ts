import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { UserPreferencesDto, UpdateUserPreferencesDto } from './dto';
import type { UiPreferences } from './types';
import { generateId, deepMerge } from '../lib/utils';

type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class UserPreferencesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreferencesDto> {
    const prefs =
      await this.database.query.userNotificationPreference.findFirst({
        where: eq(schema.userNotificationPreference.userId, userId),
      });

    if (!prefs) {
      await this.createDefaultPreferences(userId);
      return this.getUserPreferences(userId);
    }

    return {
      emailVerificationReminders: prefs.emailVerificationReminders,
      uiPreferences: (prefs.uiPreferences ??
        {}) as UserPreferencesDto['uiPreferences'],
    };
  }

  async createDefaultPreferences(userId: string): Promise<void> {
    try {
      await this.database.insert(schema.userNotificationPreference).values({
        id: generateId(),
        userId,
        emailVerificationReminders: true,
        uiPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('UNIQUE constraint failed')
      ) {
        throw error;
      }
    }
  }

  async updateUserPreferences(
    userId: string,
    updates: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    const existing =
      await this.database.query.userNotificationPreference.findFirst({
        where: eq(schema.userNotificationPreference.userId, userId),
      });

    if (!existing) {
      await this.createDefaultPreferences(userId);
    }

    const { uiPreferences, ...rest } = updates;

    // Deep-merge uiPreferences into the stored blob so partial view updates
    // (e.g. just `sessionViews.retros.sort`) don't clobber sibling settings.
    const mergedUiPreferences: UiPreferences | undefined =
      uiPreferences !== undefined
        ? (deepMerge(
            (existing?.uiPreferences as Record<string, unknown> | undefined) ??
              {},
            uiPreferences as Record<string, unknown>,
          ) as UiPreferences)
        : undefined;

    await this.database
      .update(schema.userNotificationPreference)
      .set({
        ...rest,
        ...(mergedUiPreferences !== undefined
          ? { uiPreferences: mergedUiPreferences }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.userNotificationPreference.userId, userId));

    return this.getUserPreferences(userId);
  }
}
