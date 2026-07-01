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
    ])
    .default(ICEBREAKER_SELECTION_MODES.Ordered),
  flavourFilter: z
    .enum([
      ICEBREAKER_FLAVOURS.Fun,
      ICEBREAKER_FLAVOURS.Professional,
      ICEBREAKER_FLAVOURS.Creative,
    ])
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
    enum: ['ordered', 'random'],
    required: false,
  })
  selectionMode?: string;

  @ApiProperty({
    example: 'fun',
    enum: ['fun', 'professional', 'creative'],
    required: false,
  })
  flavourFilter?: string;

  @ApiProperty({ example: 60, required: false })
  timerDuration?: number;
}
