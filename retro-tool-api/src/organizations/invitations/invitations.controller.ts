import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
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
import { OrgInvitationsService } from './invitations.service';
import type { SessionUser } from '../../common/types';

@ApiTags('organizations')
@Controller('organizations')
export class OrgInvitationsController {
  constructor(private readonly orgInvitationsService: OrgInvitationsService) {}

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview an organization invitation (public)' })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation preview' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getOrgInvitationPreview(@Param('token') token: string) {
    return this.orgInvitationsService.getOrgInvitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an organisation invitation' })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 403, description: 'Expired or wrong email' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Already accepted' })
  async acceptOrgInvitation(
    @Param('token') token: string,
    @Session() session: SessionUser,
  ) {
    return this.orgInvitationsService.acceptOrgInvitation(
      token,
      session.user.id,
    );
  }

  @Post(':id/invite')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({
    summary: 'Invite a user to the organization by email',
    description:
      'Always sends an invitation email with a token link. Use POST /:id/members for a direct add without email.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async inviteOrganizationMember(
    @Param('id') id: string,
    @Body('email') email: string,
    @Body('role') role: 'member' | 'org-admin' | 'org-owner' = 'member',
    @Session() session: SessionUser,
  ) {
    return this.orgInvitationsService.inviteOrganizationMember(
      session.user.id,
      id,
      email,
      role,
    );
  }

  @Get(':id/check-invite-email')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Check if an email belongs to a registered user' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: '{ registered: boolean, name?: string }',
  })
  async checkInviteEmail(
    @Param('id') id: string,
    @Query('email') email: string,
    @Session() session: SessionUser,
  ) {
    return this.orgInvitationsService.checkInviteEmail(
      session.user.id,
      id,
      email,
    );
  }
}
