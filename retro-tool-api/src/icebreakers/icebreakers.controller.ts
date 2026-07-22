import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
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
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import { StandupsProjectionSyncService } from '../standups/standups-projection-sync.service';
import type { SessionUser } from '../common/types';
import {
  CreateIcebreakerSessionSchema,
  CreateIcebreakerSessionBody,
  CreateIcebreakerSessionDto,
  SwipePromptSchema,
  SwipePromptBody,
  SwipePromptDto,
  StartTimerSchema,
  IcebreakerStartTimerBody,
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
    private readonly icebreakersProjectionSyncService: IcebreakersProjectionSyncService,
    private readonly standupsProjectionSync: StandupsProjectionSyncService,
  ) {}

  /**
   * Sessions attached to a standup day appear in that room's feed, so any
   * mutation must also refresh the standup entry for everyone in the room.
   */
  private async resyncStandupIfAttached(sessionId: string): Promise<void> {
    const link = await this.icebreakersService.getStandupLink(sessionId);
    if (link) {
      await this.standupsProjectionSync.enqueueEntrySync(
        link.standupId,
        link.entryDate,
      );
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
    await this.icebreakersProjectionSyncService.enqueueSessionSync(result.id);
    await this.resyncStandupIfAttached(result.id);
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
    await this.icebreakersProjectionSyncService.enqueueSessionSync(id);
    await this.resyncStandupIfAttached(id);
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
    await this.icebreakersProjectionSyncService.enqueueSessionSync(id);
    await this.resyncStandupIfAttached(id);
    return result;
  }

  @Post(':id/advance')
  @ApiOperation({
    summary:
      'Advance to the next pending prompt or finish (delete) the session',
  })
  async advancePrompt(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Capture the standup link before advancing — finishing deletes the row,
    // and the room feed still needs a resync afterwards.
    const link = await this.icebreakersService.getStandupLink(id);
    const result = await this.icebreakersService.advancePrompt(
      id,
      session.user.id,
    );
    // Finishing hard-deletes the session, so remove its projection rather than
    // re-syncing a row that no longer exists.
    if (result.ended) {
      await this.icebreakersProjectionSyncService.enqueueSessionDelete(id);
    } else {
      await this.icebreakersProjectionSyncService.enqueueSessionSync(id);
    }
    if (link) {
      await this.standupsProjectionSync.enqueueEntrySync(
        link.standupId,
        link.entryDate,
      );
    }
    return result;
  }

  @Post(':id/timer')
  @ApiOperation({ summary: 'Start a countdown timer for the current prompt' })
  @ApiBody({ type: IcebreakerStartTimerBody })
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
    await this.icebreakersProjectionSyncService.enqueueSessionSync(id);
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
    await this.icebreakersProjectionSyncService.enqueueSessionSync(id);
    await this.resyncStandupIfAttached(id);
    return result;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'End an icebreaker session (deletes it — no history)',
  })
  async endSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Capture the standup link before the row is deleted so the room feed can
    // still be refreshed afterwards.
    const link = await this.icebreakersService.getStandupLink(id);
    const result = await this.icebreakersService.endSession(
      id,
      session.user.id,
    );
    // Ending hard-deletes the session, so remove its Convex projection (and the
    // per-member board rows) rather than re-syncing a now-missing row.
    await this.icebreakersProjectionSyncService.enqueueSessionDelete(id);
    if (link) {
      await this.standupsProjectionSync.enqueueEntrySync(
        link.standupId,
        link.entryDate,
      );
    }
    return result;
  }
}
