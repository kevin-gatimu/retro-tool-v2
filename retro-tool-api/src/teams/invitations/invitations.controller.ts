import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TeamInvitationsService } from './invitations.service';
import type { SessionUser } from '../../common/types';

@ApiTags('teams')
@Controller('teams')
export class TeamInvitationsController {
  constructor(
    private readonly teamInvitationsService: TeamInvitationsService,
  ) {}

  @Get(':id/invitations')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'List pending invitations for a team' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated invitations list' })
  async listInvitations(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Session() session?: SessionUser,
  ) {
    return this.teamInvitationsService.listInvitations(session!.user.id, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending team invitation' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'invitationId',
    type: String,
    description: 'Invitation ID',
  })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  async revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamInvitationsService.revokeInvitation(
      session.user.id,
      id,
      invitationId,
    );
  }

  @Post(':id/invitations/:invitationId/resend')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a pending team invitation' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'invitationId',
    type: String,
    description: 'Invitation ID',
  })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  async resendInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamInvitationsService.resendInvitation(
      session.user.id,
      id,
      invitationId,
    );
  }

  @Get(':id/check-invite-email')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({
    summary: 'Check if an email belongs to a registered user and team member',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: '{ registered: boolean, name?: string, isMember?: boolean }',
  })
  async checkInviteEmail(
    @Param('id') id: string,
    @Query('email') email: string,
    @Session() session: SessionUser,
  ) {
    return this.teamInvitationsService.checkInviteEmail(
      session.user.id,
      id,
      email,
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
