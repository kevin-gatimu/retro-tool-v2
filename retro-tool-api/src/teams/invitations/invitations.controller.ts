import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview a team invitation (public)' })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation preview' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getTeamInvitationPreview(@Param('token') token: string) {
    return this.teamInvitationsService.getTeamInvitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a team invitation' })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 403, description: 'Expired or wrong email' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Already accepted' })
  async acceptTeamInvitation(
    @Param('token') token: string,
    @Session() session: SessionUser,
  ) {
    return this.teamInvitationsService.acceptTeamInvitation(
      token,
      session.user.id,
    );
  }

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
