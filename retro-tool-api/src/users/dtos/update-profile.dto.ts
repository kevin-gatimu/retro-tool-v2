import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  image: z.url().optional().nullable(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export class UpdateProfileDtoClass {
  @ApiPropertyOptional({ description: 'User name', minLength: 1 })
  name?: string;

  @ApiPropertyOptional({ description: 'User bio' })
  bio?: string;

  @ApiPropertyOptional({ description: 'Profile image URL', nullable: true })
  image?: string | null;
}
