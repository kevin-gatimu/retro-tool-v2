import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import {
  ICEBREAKER_FLAVOURS,
  ICEBREAKER_SELECTION_MODES,
} from '../../common/enums';

export const CreateIcebreakerSessionSchema = z.object({
  name: z.string().min(1).max(255),
  teamId: z.string().min(1),
  templateId: z.string().optional(),
  selectionMode: z
    .enum([
      ICEBREAKER_SELECTION_MODES.Ordered,
      ICEBREAKER_SELECTION_MODES.Random,
      ICEBREAKER_SELECTION_MODES.Custom,
    ])
    .default(ICEBREAKER_SELECTION_MODES.Ordered),
  flavourFilter: z
    .enum([
      ICEBREAKER_FLAVOURS.Fun,
      ICEBREAKER_FLAVOURS.Professional,
      ICEBREAKER_FLAVOURS.Creative,
    ])
    .optional(),
  // One-off prompts authored at creation time (Custom mode). Materialised
  // straight into the session deck — not persisted as a reusable template.
  customPrompts: z
    .array(
      z.object({
        text: z.string().min(1).max(500),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  // When attaching the session to a standup day (both required together).
  standupId: z.string().optional(),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timerDuration: z.number().int().positive().max(3600).optional(),
});

export type CreateIcebreakerSessionDto = z.infer<
  typeof CreateIcebreakerSessionSchema
>;

export class CreateIcebreakerSessionBody {
  @ApiProperty({ example: 'Monday Standup Warm-up' })
  name: string;

  @ApiProperty({ example: 'team_abc123' })
  teamId: string;

  @ApiProperty({
    example: '1ceb0001-0000-4000-a000-000000000001',
    required: false,
  })
  templateId?: string;

  @ApiProperty({
    example: 'ordered',
    enum: ['ordered', 'random', 'custom'],
    required: false,
  })
  selectionMode?: string;

  @ApiProperty({
    example: 'fun',
    enum: ['fun', 'professional', 'creative'],
    required: false,
  })
  flavourFilter?: string;

  @ApiProperty({
    required: false,
    description: 'One-off prompts authored at creation (Custom mode)',
    example: [{ text: 'What is your walk-on song?' }],
  })
  customPrompts?: { text: string; color?: string }[];

  @ApiProperty({
    example: 'standup_abc123',
    required: false,
    description: 'Standup to attach this session to a daily room',
  })
  standupId?: string;

  @ApiProperty({
    example: '2026-07-06',
    required: false,
    description: 'Entry date (YYYY-MM-DD) when attached to a standup',
  })
  entryDate?: string;

  @ApiProperty({ example: 60, required: false })
  timerDuration?: number;
}
