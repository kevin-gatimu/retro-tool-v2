import {
  Controller,
  Get,
  Post,
  Param,
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
import { OrganizationsService } from './organizations.service';
import type { SessionUser } from '../common/types';

@ApiTags('organizations')
@Controller('organizations/invitations')
export class OrgInvitationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an organisation invitation (public)' })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation preview' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getOrgInvitationPreview(@Param('token') token: string) {
    return this.organizationsService.getOrgInvitationPreview(token);
  }

  @Post(':token/accept')
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
    return this.organizationsService.acceptOrgInvitation(
      token,
      session.user.id,
    );
  }
}
