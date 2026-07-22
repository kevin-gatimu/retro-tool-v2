import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { TEAM_MEMBER_TAGS, TTeamMemberTag } from '../../../common/enums';

export const inviteTeamMemberSchema = z.object({
  email: z.email().max(320),
  tag: z.enum(TEAM_MEMBER_TAGS).default(TEAM_MEMBER_TAGS.Member),
});

export type InviteTeamMemberDto = z.infer<typeof inviteTeamMemberSchema>;

export class InviteTeamMemberDtoClass {
  @ApiProperty({ description: 'Invitee email address', maxLength: 320 })
  email: string;

  @ApiProperty({
    description: 'Team rank to grant on acceptance (team-lead or member)',
    enum: TEAM_MEMBER_TAGS,
    default: TEAM_MEMBER_TAGS.Member,
  })
  tag: TTeamMemberTag;
}
