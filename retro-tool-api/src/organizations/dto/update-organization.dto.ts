import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  logo: z.url().optional().or(z.literal('')),
});

export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

export class UpdateOrganizationDtoClass {
  @ApiPropertyOptional({ description: 'Organization name', maxLength: 255 })
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization slug (lowercase, numbers, and hyphens only)',
    pattern: '^[a-z0-9-]+$',
    maxLength: 255,
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Organization logo URL' })
  logo?: string;
}
