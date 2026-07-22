import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const createActionItemCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

export type CreateActionItemCommentDto = z.infer<
  typeof createActionItemCommentSchema
>;

export class CreateActionItemCommentDtoClass {
  @ApiProperty({ description: 'Comment content', maxLength: 500 })
  content: string;
}
