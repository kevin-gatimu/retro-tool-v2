import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  emoji: z.string().max(100).optional(),
});

export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;

export class UpdateTeamDtoClass {
  @ApiPropertyOptional({ description: 'Team name', maxLength: 255 })
  name?: string;

  @ApiPropertyOptional({ description: 'Team description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Team emoji', maxLength: 10 })
  emoji?: string;
}
