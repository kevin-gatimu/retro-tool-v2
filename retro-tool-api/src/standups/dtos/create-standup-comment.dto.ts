import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const createStandupCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});
export type CreateStandupCommentDto = z.infer<
  typeof createStandupCommentSchema
>;

export class CreateStandupCommentDtoClass {
  @ApiProperty({ description: 'Comment content', maxLength: 1000 })
  content: string;
}
