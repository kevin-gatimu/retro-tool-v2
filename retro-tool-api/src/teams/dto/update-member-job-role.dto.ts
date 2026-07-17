import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateMemberJobRoleSchema = z.object({
  // Absent or null both clear the job role; a non-empty string assigns one.
  roleId: z.string().min(1).nullable().optional(),
});

export type UpdateMemberJobRoleDto = z.infer<typeof updateMemberJobRoleSchema>;

export class UpdateMemberJobRoleDtoClass {
  @ApiPropertyOptional({
    description: 'Team role ID to assign, or null/omit to clear',
    nullable: true,
  })
  roleId?: string | null;
}
