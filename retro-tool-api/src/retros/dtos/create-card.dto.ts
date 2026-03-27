import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const createCardSchema = z.object({
  retroId: z.string().min(1),
  columnId: z.string().min(1),
  content: z.string().min(1).max(1000),
});
export type CreateCardDto = z.infer<typeof createCardSchema>;

export class CreateCardDtoClass {
  @ApiProperty({ description: 'Retrospective ID' })
  retroId: string;

  @ApiProperty({ description: 'Template column ID' })
  columnId: string;

  @ApiProperty({ description: 'Card content', maxLength: 1000 })
  content: string;
}
