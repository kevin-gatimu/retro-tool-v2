import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { SessionsService } from './sessions.service';
import {
  revokeSessionSchema,
  RevokeSessionDto,
  RevokeSessionDtoClass,
} from './dtos';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUserWithSession as SessionUser } from '../common/types';

@ApiTags('sessions')
@Controller('sessions')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all sessions for the current user' })
  @ApiResponse({ status: 200, description: 'Returns list of sessions' })
  async listSessions(@Session() session: SessionUser) {
    return this.sessionsService.listSessions(session.user.id);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session by token' })
  @ApiBody({ type: RevokeSessionDtoClass })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your session' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @UsePipes(new ZodValidationPipe(revokeSessionSchema))
  async revokeSession(
    @Body() body: RevokeSessionDto,
    @Session() session: SessionUser,
  ) {
    return this.sessionsService.revokeSession(session.user.id, body);
  }

  @Delete('others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  @ApiResponse({
    status: 200,
    description: 'Other sessions revoked successfully',
  })
  async revokeOtherSessions(@Session() session: SessionUser) {
    return this.sessionsService.revokeOtherSessions(
      session.user.id,
      session.session.id,
    );
  }
}
