import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const mergeCardsSchema = z.object({
  cardIds: z.array(z.string().min(1)).min(2),
  content: z.string().min(1).max(2000).optional(),
  columnId: z.string().min(1).optional(),
});

export type MergeCardsDto = z.infer<typeof mergeCardsSchema>;

export class MergeCardsDtoClass {
  @ApiProperty({
    description: 'Card IDs to merge (must belong to the same retrospective)',
    type: [String],
    minItems: 2,
  })
  cardIds: string[];

  @ApiPropertyOptional({
    description:
      'Optional merged content. If omitted, content is auto-generated.',
    maxLength: 2000,
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'Optional target column ID for the merged card.',
  })
  columnId?: string;
}
