import { z } from 'zod';
import { TUserRole, USER_ROLES } from '../../common/enums';
import { ApiProperty } from '@nestjs/swagger';

export const updateRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export class UpdateRoleDtoClass {
  @ApiProperty({ description: 'New user role', enum: USER_ROLES })
  role: TUserRole;
}
