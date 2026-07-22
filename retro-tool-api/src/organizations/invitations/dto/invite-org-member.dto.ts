import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { ORG_MEMBER_ROLES, TOrgMemberRole } from '../../../common/enums';

// `role` is validated against the known org roles so arbitrary strings are
// rejected at the boundary. Granting `org-owner` is still gated server-side in
// the service (owner / system-admin only) — the DTO only closes the runtime
// type-safety gap, not the authorization check.
export const inviteOrgMemberSchema = z.object({
  email: z.email().max(320),
  role: z
    .enum([
      ORG_MEMBER_ROLES.Owner,
      ORG_MEMBER_ROLES.Admin,
      ORG_MEMBER_ROLES.Member,
    ])
    .default(ORG_MEMBER_ROLES.Member),
});

export type InviteOrgMemberDto = z.infer<typeof inviteOrgMemberSchema>;

export class InviteOrgMemberDtoClass {
  @ApiProperty({ description: 'Invitee email address', maxLength: 320 })
  email: string;

  @ApiProperty({
    description: 'Role to grant on acceptance',
    enum: [
      ORG_MEMBER_ROLES.Owner,
      ORG_MEMBER_ROLES.Admin,
      ORG_MEMBER_ROLES.Member,
    ],
    default: ORG_MEMBER_ROLES.Member,
  })
  role: TOrgMemberRole;
}
