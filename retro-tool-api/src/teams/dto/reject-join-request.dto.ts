import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const rejectJoinRequestSchema = z.object({
  reviewNote: z.string().max(1000).optional(),
});

export type RejectJoinRequestDto = z.infer<typeof rejectJoinRequestSchema>;

export class RejectJoinRequestDtoClass {
  @ApiPropertyOptional({
    description: 'Optional note explaining the rejection',
    maxLength: 1000,
  })
  reviewNote?: string;
}
