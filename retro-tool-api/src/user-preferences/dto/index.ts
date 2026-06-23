import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Per-page view config for the Team Spaces feature. `z.looseObject` keeps
// unknown keys (so future view fields are not stripped by the pipe) and
// `.partial()` makes every field optional so partial PATCHes are accepted.
export const sessionViewSchema = z
  .looseObject({
    space: z.string(),
    groupBy: z.enum(['space-status', 'status', 'space', 'none']),
    layout: z.enum(['cards', 'list']),
    sort: z.enum(['recent', 'oldest', 'name']),
    favorites: z.array(z.string()),
    showCompleted: z.boolean(),
    collapsedGroups: z.array(z.string()).optional(),
  })
  .partial();

export const uiPreferencesSchema = z.looseObject({
  sessionViews: z
    .looseObject({
      retros: sessionViewSchema.optional(),
      estimates: sessionViewSchema.optional(),
    })
    .partial()
    .optional(),
});

// Zod schemas for validation
export const userPreferencesSchema = z.object({
  emailVerificationReminders: z.boolean().default(true),
  uiPreferences: uiPreferencesSchema.optional(),
});

export const updateUserPreferencesSchema = userPreferencesSchema.partial();

// Types from Zod schemas
export type UserPreferencesDto = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesDto = z.infer<
  typeof updateUserPreferencesSchema
>;

// Re-export the UI preference contract so consumers have a single import site.
export type {
  UiPreferences,
  SessionView,
  SessionViewSpace,
  GroupByMode,
  LayoutMode,
  SortMode,
} from '../types';

// Swagger DTO classes
export class UserPreferencesDtoClass {
  @ApiProperty({
    description: 'Enable email verification reminders',
    default: true,
  })
  emailVerificationReminders: boolean;

  @ApiPropertyOptional({
    description:
      'Remembered UI preferences (Team Spaces views, layout, sort, favorites)',
    type: 'object',
    additionalProperties: true,
  })
  uiPreferences?: Record<string, unknown>;
}

export class UpdateUserPreferencesDtoClass {
  @ApiPropertyOptional({
    description: 'Enable email verification reminders',
    default: true,
  })
  emailVerificationReminders?: boolean;

  @ApiPropertyOptional({
    description:
      'Remembered UI preferences (Team Spaces views, layout, sort, favorites). Deep-merged server-side.',
    type: 'object',
    additionalProperties: true,
  })
  uiPreferences?: Record<string, unknown>;
}
