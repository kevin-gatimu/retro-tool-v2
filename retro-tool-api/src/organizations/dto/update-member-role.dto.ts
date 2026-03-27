import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { ORG_ASSIGNABLE_ROLES, TOrgAssignableRole } from '../../common/enums';

export const updateMemberRoleSchema = z.object({
  role: z.enum(ORG_ASSIGNABLE_ROLES),
});

export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;

export class UpdateMemberRoleDtoClass {
  @ApiProperty({
    description: 'New org role to assign (org-admin or member)',
    enum: ORG_ASSIGNABLE_ROLES,
  })
  role: TOrgAssignableRole;
}
