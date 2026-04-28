import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Zod schemas for validation
export const userPreferencesSchema = z.object({
  emailVerificationReminders: z.boolean().default(true),
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
}

export class UpdateUserPreferencesDtoClass {
  @ApiPropertyOptional({
    description: 'Enable email verification reminders',
    default: true,
  })
  emailVerificationReminders?: boolean;
}
