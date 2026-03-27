import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;

export class CreateCommentDtoClass {
  @ApiProperty({ description: 'Comment content', maxLength: 500 })
  content: string;
}
