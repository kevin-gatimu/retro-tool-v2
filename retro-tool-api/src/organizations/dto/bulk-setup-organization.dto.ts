import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const bulkSetupOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  logo: z.url().optional(),
  ownerId: z.string().min(1).optional(),
  adminIds: z.array(z.string().min(1)).default([]),
  memberIds: z.array(z.string().min(1)).default([]),
  teams: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        leadId: z.string().min(1).optional(),
      }),
    )
    .default([]),
});

export type BulkSetupOrganizationDto = z.infer<
  typeof bulkSetupOrganizationSchema
>;

class TeamSetupDtoClass {
  @ApiProperty({ description: 'Team name' })
  name: string;

  @ApiPropertyOptional({ description: 'User ID to set as team lead' })
  leadId?: string;
}

export class BulkSetupOrganizationDtoClass {
  @ApiProperty({ description: 'Organisation name' })
  name: string;

  @ApiProperty({
    description: 'Unique slug (lowercase letters, numbers, hyphens)',
  })
  slug: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  logo?: string;

  @ApiPropertyOptional({ description: 'User ID to set as org owner' })
  ownerId?: string;

  @ApiPropertyOptional({ description: 'User IDs to add as org admins' })
  adminIds?: string[];

  @ApiPropertyOptional({ description: 'User IDs to add as members' })
  memberIds?: string[];

  @ApiPropertyOptional({
    description: 'Teams to create inside the organisation',
    type: [TeamSetupDtoClass],
  })
  teams?: TeamSetupDtoClass[];
}
