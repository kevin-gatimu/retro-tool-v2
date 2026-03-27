import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
  logo: z.url().optional().or(z.literal('')),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;

export class CreateOrganizationDtoClass {
  @ApiProperty({ description: 'Organization name', maxLength: 255 })
  name: string;

  @ApiProperty({
    description: 'Organization slug (lowercase, numbers, and hyphens only)',
    pattern: '^[a-z0-9-]+$',
    maxLength: 255,
  })
  slug: string;

  @ApiPropertyOptional({ description: 'Organization logo URL' })
  logo?: string;
}
