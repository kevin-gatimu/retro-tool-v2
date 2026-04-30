import {
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { OrgInvitationsService } from './invitations.service';
import type { SessionUser } from '../../common/types';

@ApiTags('organizations')
@Controller('organizations')
export class OrgInvitationsController {
  constructor(private readonly orgInvitationsService: OrgInvitationsService) {}

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
