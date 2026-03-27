import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  emoji: z.string().max(100).optional(),
  organizationId: z.string().min(1),
});

export type CreateTeamDto = z.infer<typeof createTeamSchema>;

export class CreateTeamDtoClass {
  @ApiProperty({ description: 'Team name', maxLength: 255 })
  name: string;

  @ApiPropertyOptional({ description: 'Team description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Team emoji', maxLength: 10 })
  emoji?: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId: string;
}
