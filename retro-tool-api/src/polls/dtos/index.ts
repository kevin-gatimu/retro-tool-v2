import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createPollSchema = z.object({
  question: z.string().min(1).max(500),
  teamId: z.string().min(1),
  standupId: z.string().optional(),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isAnonymous: z.boolean().default(false),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(255),
        emoji: z.string().max(50).optional().nullable(),
      }),
    )
    .min(2)
    .max(10),
});
export type CreatePollDto = z.infer<typeof createPollSchema>;

export class CreatePollDtoClass {
  @ApiProperty({ description: 'Poll question', maxLength: 500 })
  question: string;

  @ApiProperty({ description: 'Team ID' })
  teamId: string;

  @ApiPropertyOptional({
    description: 'Standup ID to attach the poll to a daily room',
  })
  standupId?: string;

  @ApiPropertyOptional({
    description: 'Entry date (YYYY-MM-DD) when attached to a standup',
  })
  entryDate?: string;

  @ApiPropertyOptional({ description: 'Hide voter identities', default: false })
  isAnonymous?: boolean;

  @ApiProperty({
    description: 'Poll options (2–10)',
    example: [
      { label: 'Fantastic', emoji: '😄' },
      { label: 'Good', emoji: '🙂' },
      { label: 'Okay', emoji: '😐' },
    ],
  })
  options: Array<{ label: string; emoji?: string | null }>;
}

export const updatePollSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  isAnonymous: z.boolean().optional(),
  options: z
    .array(
      z.object({
        // Present for existing options (preserves their votes); omitted for
        // newly added ones.
        id: z.string().optional(),
        label: z.string().min(1).max(255),
        emoji: z.string().max(50).optional().nullable(),
      }),
    )
    .min(2)
    .max(10)
    .optional(),
});
export type UpdatePollDto = z.infer<typeof updatePollSchema>;

export class UpdatePollDtoClass {
  @ApiPropertyOptional({ description: 'Poll question', maxLength: 500 })
  question?: string;

  @ApiPropertyOptional({ description: 'Hide voter identities' })
  isAnonymous?: boolean;

  @ApiPropertyOptional({
    description:
      'Poll options (2–10). Include an option `id` to keep its votes; omit `id` for new options. Options no longer present are removed along with their votes.',
    example: [
      { id: 'opt-1', label: 'Fantastic', emoji: '😄' },
      { label: 'Great', emoji: '🤩' },
    ],
  })
  options?: Array<{ id?: string; label: string; emoji?: string | null }>;
}

export const votePollSchema = z.object({
  optionId: z.string().min(1),
});
export type VotePollDto = z.infer<typeof votePollSchema>;

export class VotePollDtoClass {
  @ApiProperty({ description: 'Option ID to vote for' })
  optionId: string;
}
