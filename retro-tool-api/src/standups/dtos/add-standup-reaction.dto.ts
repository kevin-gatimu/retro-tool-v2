import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const addStandupReactionSchema = z.object({
  emoji: z.string().min(1).max(50),
});
export type AddStandupReactionDto = z.infer<typeof addStandupReactionSchema>;

export class AddStandupReactionDtoClass {
  @ApiProperty({ description: 'Emoji character', example: '🎉' })
  emoji: string;
}
