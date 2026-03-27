import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { ORG_ASSIGNABLE_ROLES, TOrgAssignableRole } from '../../common/enums';

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ORG_ASSIGNABLE_ROLES),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;

export class AddMemberDtoClass {
  @ApiProperty({ description: 'User ID to add' })
  userId: string;

  @ApiProperty({
    description: 'Org role to assign (org-admin or member)',
    enum: ORG_ASSIGNABLE_ROLES,
  })
  role: TOrgAssignableRole;
}
