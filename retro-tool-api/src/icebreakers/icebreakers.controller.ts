import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IcebreakersService } from './icebreakers.service';
import { IcebreakersQueryService } from './icebreakers-query.service';
import { IcebreakersCreationService } from './icebreakers-creation.service';
import { IcebreakersGateway } from './icebreakers.gateway';
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import { StandupsGateway } from '../standups/standups.gateway';
import type { SessionUser } from '../common/types';
import {
  CreateIcebreakerSessionSchema,
  CreateIcebreakerSessionBody,
  CreateIcebreakerSessionDto,
  SwipePromptSchema,
  SwipePromptBody,
  SwipePromptDto,
  StartTimerSchema,
  StartTimerBody,
  StartTimerDto,
  UpdateSessionSchema,
  UpdateSessionBody,
  UpdateSessionDto,
} from './dtos';

// The `*Body` classes exist only for Swagger (@ApiBody) — their fields are
// widened (e.g. `selectionMode: string`). The ZodValidationPipe parses the
// request into the narrow `*Dto` (z.infer) shape at runtime, so the handler
// receives a validated DTO; document with @ApiBody and type @Body as the DTO.

@ApiTags('icebreakers')
@Controller('icebreakers')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class IcebreakersController {
  constructor(
    private readonly icebreakersService: IcebreakersService,
    private readonly icebreakersQueryService: IcebreakersQueryService,
    private readonly icebreakersCreationService: IcebreakersCreationService,
    private readonly icebreakersGateway: IcebreakersGateway,
    private readonly icebreakersProjectionSyncService: IcebreakersProjectionSyncService,
    private readonly standupsGateway: StandupsGateway,
  ) {}

  /**
   * Sessions attached to a standup day appear in that room's feed, so any
   * mutation must also refresh the standup entry for everyone in the room.
   */
  private async emitStandupIfAttached(sessionId: string): Promise<void> {
    const link = await this.icebreakersService.getStandupLink(sessionId);
    if (link) {
      this.standupsGateway.emitEntryChanged(link.standupId, link.entryDate);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List all icebreaker sessions for the current user',
  })
  @ApiResponse({ status: 200, description: 'Session list' })
  getSessions(@Session() session: SessionUser) {
    return this.icebreakersQueryService.getSessions(session.user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'List active (non-completed) icebreaker sessions' })
  @ApiResponse({ status: 200, description: 'Active session list' })
  getActiveSessions(@Session() session: SessionUser) {
    return this.icebreakersQueryService.getActiveSessions(session.user.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'List completed icebreaker sessions (paginated, role-scoped)',
  })
  @ApiResponse({ status: 200, description: 'Completed session history' })
  getHistory(
    @Session() session: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('teamId') teamId?: string,
    @Query('search') search?: string,
  ) {
    return this.icebreakersQueryService.getHistory(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 15,
      teamId,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single icebreaker session with deck, participants, responses',
  })
  @ApiResponse({ status: 200, description: 'Session detail' })
  getSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.icebreakersQueryService.getSession(session.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new icebreaker session' })
  @ApiBody({ type: CreateIcebreakerSessionBody })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @UsePipes(new ZodValidationPipe(CreateIcebreakerSessionSchema))
  async createSession(
    @Session() session: SessionUser,
    @Body() body: CreateIcebreakerSessionDto,
  ) {
    const result = await this.icebreakersCreationService.createSession(
      session.user.id,
      body,
    );
    this.icebreakersGateway.emitSessionChanged(result.id);
    await this.emitStandupIfAttached(result.id);
    return result;
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an icebreaker session as a participant' })
  async joinSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.icebreakersService.upsertParticipant(
      id,
      session.user.id,
      true,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    await this.emitStandupIfAttached(id);
    return result;
  }

  @Post(':id/swipe')
  @ApiOperation({
    summary: 'Facilitator keeps or skips a specific prompt card',
  })
  @ApiBody({ type: SwipePromptBody })
  @UsePipes(new ZodValidationPipe(SwipePromptSchema))
  async swipePrompt(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SwipePromptDto,
  ) {
    const result = await this.icebreakersService.swipePrompt(
      id,
      session.user.id,
      body.decision,
      body.sessionPromptId,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    await this.emitStandupIfAttached(id);
    return result;
  }

  @Post(':id/advance')
  @ApiOperation({
    summary: 'Advance to the next pending prompt or complete the session',
  })
  async advancePrompt(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.icebreakersService.advancePrompt(
      id,
      session.user.id,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    await this.emitStandupIfAttached(id);
    return result;
  }

  @Post(':id/timer')
  @ApiOperation({ summary: 'Start a countdown timer for the current prompt' })
  @ApiBody({ type: StartTimerBody })
  @UsePipes(new ZodValidationPipe(StartTimerSchema))
  async startTimer(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StartTimerDto,
  ) {
    const result = await this.icebreakersService.startTimer(
      id,
      session.user.id,
      body.duration,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session name' })
  @ApiBody({ type: UpdateSessionBody })
  @UsePipes(new ZodValidationPipe(UpdateSessionSchema))
  async updateSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSessionDto,
  ) {
    const result = await this.icebreakersService.updateSessionName(
      id,
      body.name,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    await this.emitStandupIfAttached(id);
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'End an icebreaker session (mark completed)' })
  async endSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.icebreakersService.endSession(
      id,
      session.user.id,
    );
    this.icebreakersGateway.emitSessionChanged(id);
    await this.emitStandupIfAttached(id);
    return result;
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete an icebreaker session' })
  async deleteSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Capture the standup link before the row is gone so we can still refresh
    // the room feed after deletion.
    const link = await this.icebreakersService.getStandupLink(id);
    const result = await this.icebreakersService.deleteSession(
      id,
      session.user.id,
    );
    await this.icebreakersProjectionSyncService.enqueueSessionDelete(id);
    if (link) {
      this.standupsGateway.emitEntryChanged(link.standupId, link.entryDate);
    }
    return result;
  }
}
