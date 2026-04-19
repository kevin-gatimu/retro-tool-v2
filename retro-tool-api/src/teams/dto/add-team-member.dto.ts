import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TEAM_MEMBER_TAGS, TTeamMemberTag } from '../../common/enums';

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().nullable().optional(),
  tag: z.enum(TEAM_MEMBER_TAGS).default(TEAM_MEMBER_TAGS.Member),
});

export type AddTeamMemberDto = z.infer<typeof addTeamMemberSchema>;

export class AddTeamMemberDtoClass {
  @ApiProperty({ description: 'User ID to add' })
  userId: string;

  @ApiPropertyOptional({ description: 'Team role ID (from team_role table)' })
  roleId?: string | null;

  @ApiPropertyOptional({
    description: 'Team rank (team-lead or member)',
    enum: TEAM_MEMBER_TAGS,
    default: TEAM_MEMBER_TAGS.Member,
  })
  tag?: TTeamMemberTag;
}
