import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TeamInvitationsService } from './invitations.service';
import type { SessionUser } from '../../common/types';

@ApiTags('teams')
@Controller('teams')
export class TeamInvitationsController {
  constructor(
    private readonly teamInvitationsService: TeamInvitationsService,
  ) {}

  @Post(':id/invite')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Invite a user to the team by email' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async inviteTeamMember(
    @Param('id') id: string,
    @Body('email') email: string,
    @Body('tag') tag: 'member' | 'team-lead' = 'member',
    @Session() session: SessionUser,
  ) {
    return this.teamInvitationsService.inviteTeamMember(
      session.user.id,
      id,
      email,
      tag,
    );
  }
}
