import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const createJoinRequestSchema = z.object({
  message: z.string().max(1000).optional(),
});

export type CreateJoinRequestDto = z.infer<typeof createJoinRequestSchema>;

export class CreateJoinRequestDtoClass {
  @ApiPropertyOptional({
    description: 'Optional message to team managers',
    maxLength: 1000,
  })
  message?: string;
}
