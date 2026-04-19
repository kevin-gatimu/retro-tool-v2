import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TEAM_MEMBER_TAGS, TTeamMemberTag } from '../../common/enums';

export const updateTeamMemberSchema = z.object({
  roleId: z.string().nullable().optional(),
  tag: z.enum(TEAM_MEMBER_TAGS).optional(),
});

export type UpdateTeamMemberDto = z.infer<typeof updateTeamMemberSchema>;

export class UpdateTeamMemberDtoClass {
  @ApiPropertyOptional({ description: 'Team role ID (from team_role table)' })
  roleId?: string | null;

  @ApiPropertyOptional({
    description: 'Team rank (team-lead or member)',
    enum: TEAM_MEMBER_TAGS,
  })
  tag?: TTeamMemberTag;
}
