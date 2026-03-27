import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const updateCardSchema = z.object({
  content: z.string().min(1).max(1000),
});
export type UpdateCardDto = z.infer<typeof updateCardSchema>;

export class UpdateCardDtoClass {
  @ApiProperty({ description: 'Updated card content', maxLength: 1000 })
  content: string;
}
