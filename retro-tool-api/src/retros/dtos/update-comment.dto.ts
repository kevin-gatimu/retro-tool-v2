import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(500),
});
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;

export class UpdateCommentDtoClass {
  @ApiProperty({ description: 'Comment content', maxLength: 500 })
  content: string;
}
