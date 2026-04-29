import {
  Controller,
  Get,
  Param,
  Post,
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
import { InvitationsService } from './invitations.service';
import type { SessionUser } from '../common/types';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('preview/:token')
  @ApiOperation({
    summary:
      'Preview an invitation (works for both org and team tokens; public)',
  })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation preview' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getPreview(@Param('token') token: string) {
    return this.invitationsService.getPreview(token);
  }

  @Post(':token/accept')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an invitation (works for both org and team tokens)',
  })
  @ApiParam({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 403, description: 'Expired or wrong email' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Already accepted' })
  async accept(@Param('token') token: string, @Session() session: SessionUser) {
    return this.invitationsService.accept(token, session.user.id);
  }
}
