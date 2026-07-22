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
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { OrgInvitationsService } from './invitations.service';
import type { SessionUser } from '../../common/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  inviteOrgMemberSchema,
  InviteOrgMemberDto,
  InviteOrgMemberDtoClass,
} from './dto';

@ApiTags('organizations')
@Controller('organizations')
export class OrgInvitationsController {
  constructor(private readonly orgInvitationsService: OrgInvitationsService) {}

  @Get(':id/invitations')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'List pending invitations for an organization' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
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
    return this.orgInvitationsService.listInvitations(session!.user.id, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending organization invitation' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
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
    return this.orgInvitationsService.revokeInvitation(
      session.user.id,
      id,
      invitationId,
    );
  }

  @Post(':id/invitations/:invitationId/resend')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a pending organization invitation' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
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
    return this.orgInvitationsService.resendInvitation(
      session.user.id,
      id,
      invitationId,
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
  @ApiBody({ type: InviteOrgMemberDtoClass })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UsePipes(new ZodValidationPipe(inviteOrgMemberSchema))
  async inviteOrganizationMember(
    @Param('id') id: string,
    @Body() body: InviteOrgMemberDto,
    @Session() session: SessionUser,
  ) {
    return this.orgInvitationsService.inviteOrganizationMember(
      session.user.id,
      id,
      body.email,
      body.role,
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
