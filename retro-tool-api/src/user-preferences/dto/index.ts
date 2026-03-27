import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WEEKLY_DIGEST_DAYS,
  TWeeklyDigestDay,
} from '../../common/enums/preference.enums';

// Zod schemas for validation
export const userPreferencesSchema = z.object({
  emailVerificationReminders: z.boolean().default(true),
  weeklyDigestEnabled: z.boolean().default(true),
  weeklyDigestDay: z
    .enum(Object.values(WEEKLY_DIGEST_DAYS) as [string, ...string[]])
    .default(WEEKLY_DIGEST_DAYS.Monday),
  retrospectiveRemindersEnabled: z.boolean().default(true),
  retrospectiveReminderHours: z.number().int().min(0).max(72).default(24),
  teamActivityEmailsEnabled: z.boolean().default(false),
});

export const updateUserPreferencesSchema = userPreferencesSchema.partial();

// Types from Zod schemas
export type UserPreferencesDto = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesDto = z.infer<
  typeof updateUserPreferencesSchema
>;

// Swagger DTO classes
export class UserPreferencesDtoClass {
  @ApiProperty({
    description: 'Enable email verification reminders',
    default: true,
  })
  emailVerificationReminders: boolean;

  @ApiProperty({ description: 'Enable weekly digest emails', default: true })
  weeklyDigestEnabled: boolean;

  @ApiProperty({
    description: 'Day of the week for weekly digest',
    enum: Object.values(WEEKLY_DIGEST_DAYS),
    default: 'monday',
  })
  weeklyDigestDay: TWeeklyDigestDay;

  @ApiProperty({
    description: 'Enable retrospective reminders',
    default: true,
  })
  retrospectiveRemindersEnabled: boolean;

  @ApiProperty({
    description: 'Hours before retrospective to send reminder',
    minimum: 0,
    maximum: 72,
    default: 24,
  })
  retrospectiveReminderHours: number;

  @ApiProperty({
    description: 'Enable team activity emails',
    default: false,
  })
  teamActivityEmailsEnabled: boolean;
}

export class UpdateUserPreferencesDtoClass {
  @ApiPropertyOptional({
    description: 'Enable email verification reminders',
    default: true,
  })
  emailVerificationReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Enable weekly digest emails',
    default: true,
  })
  weeklyDigestEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Day of the week for weekly digest',
    enum: Object.values(WEEKLY_DIGEST_DAYS),
    default: 'monday',
  })
  weeklyDigestDay?: TWeeklyDigestDay;

  @ApiPropertyOptional({
    description: 'Enable retrospective reminders',
    default: true,
  })
  retrospectiveRemindersEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Hours before retrospective to send reminder',
    minimum: 0,
    maximum: 72,
    default: 24,
  })
  retrospectiveReminderHours?: number;

  @ApiPropertyOptional({
    description: 'Enable team activity emails',
    default: false,
  })
  teamActivityEmailsEnabled?: boolean;
}
