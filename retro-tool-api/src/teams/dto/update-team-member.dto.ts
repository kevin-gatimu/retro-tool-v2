import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  TEAM_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  TTeamMemberRole,
  TTeamMemberTag,
} from '../../common/enums';

export const updateTeamMemberSchema = z.object({
  role: z.enum(TEAM_MEMBER_ROLES).optional(),
  tag: z.enum(TEAM_MEMBER_TAGS).optional(),
});

export type UpdateTeamMemberDto = z.infer<typeof updateTeamMemberSchema>;

export class UpdateTeamMemberDtoClass {
  @ApiPropertyOptional({
    description: 'Member role',
    enum: TEAM_MEMBER_ROLES,
  })
  role?: TTeamMemberRole;

  @ApiPropertyOptional({
    description: 'Team rank (team-lead or member)',
    enum: TEAM_MEMBER_TAGS,
  })
  tag?: TTeamMemberTag;
}
