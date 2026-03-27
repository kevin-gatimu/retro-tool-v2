import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TEAM_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  TTeamMemberRole,
  TTeamMemberTag,
} from '../../common/enums';

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(TEAM_MEMBER_ROLES).optional(),
  tag: z.enum(TEAM_MEMBER_TAGS).default(TEAM_MEMBER_TAGS.Member),
});

export type AddTeamMemberDto = z.infer<typeof addTeamMemberSchema>;

export class AddTeamMemberDtoClass {
  @ApiProperty({ description: 'User ID to add' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Member role',
    enum: TEAM_MEMBER_ROLES,
  })
  role?: TTeamMemberRole;

  @ApiPropertyOptional({
    description: 'Team rank (team-lead or member)',
    enum: TEAM_MEMBER_TAGS,
    default: TEAM_MEMBER_TAGS.Member,
  })
  tag?: TTeamMemberTag;
}
