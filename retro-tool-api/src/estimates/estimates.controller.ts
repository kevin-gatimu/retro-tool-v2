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
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EstimatesService } from './estimates.service';
import { EstimatesReportService } from './estimates-report.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import type { SessionUser } from '../common/types';
import {
  CreateEstimateSessionSchema,
  CreateEstimateSessionDto,
  CreateEstimateSessionBody,
  NewEstimateRoundBody,
  NewEstimateRoundDto,
  NewEstimateRoundSchema,
  UpdateEstimateStoryBody,
  UpdateEstimateStoryDto,
  UpdateEstimateStorySchema,
  SetConsensusSchema,
  SetConsensusBody,
  type SetConsensusDto,
  CastVoteSchema,
  CastVoteBody,
  type CastVoteDto,
  ParticipantPresenceSchema,
  ParticipantPresenceBody,
  type ParticipantPresenceDto,
  UpdateSessionNameSchema,
  UpdateSessionNameBody,
  type UpdateSessionNameDto,
  StartTimerSchema,
  EstimateStartTimerBody,
  type StartTimerDto,
  sendEstimateReportSchema,
  SendEstimateReportDto,
  SendEstimateReportDtoClass,
} from './dtos';

@ApiTags('estimates')
@Controller('estimates')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly estimatesReportService: EstimatesReportService,
    private readonly estimatesProjectionSync: EstimatesProjectionSyncService,
  ) {}

  /**
   * Push the session's latest state to the Convex projection via the
   * outbox-backed sync service. Estimates run Convex-only for realtime: the UI
   * subscribes to the projection (plus a slow backstop poll) rather than a
   * Socket.IO room, so every write path funnels through here after mutating.
   */
  private syncSession(sessionId: string): void {
    void this.estimatesProjectionSync.enqueueSessionSync(sessionId);
  }

  /**
   * Mirror the gateway's per-command membership gate: handshake/session auth
   * proves identity, not membership. Without this a member of no relation to the
   * session's team could join or cast votes by ID (SECURITY-ASSESSMENT F2).
   */
  private async assertSessionMember(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const isMember = await this.estimatesService.isSessionMember(
      sessionId,
      userId,
    );
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this session');
    }
  }

  /** Mirror the gateway's manager-only gate for end/delete commands. */
  private async assertCanManage(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const canManage = await this.estimatesService.canManageSession(
      sessionId,
      userId,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to manage this session',
      );
    }
  }

  /**
   * Mirror the gateway's control-only gate for session-driving commands
   * (reveal/revote/round/consensus/timer/story). Narrower than
   * {@link assertCanManage}: creator or team lead only, not org/system admins.
   */
  private async assertCanControl(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const canControl = await this.estimatesService.canControlSession(
      sessionId,
      userId,
    );
    if (!canControl) {
      throw new ForbiddenException(
        'Only the session creator or a team lead can do this action',
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all estimate sessions for the current user' })
  @ApiResponse({ status: 200, description: 'Session list' })
  getSessions(@Session() session: SessionUser) {
    return this.estimatesService.getSessions(session.user.id);
  }

  @Get('active')
  @ApiOperation({
    summary: 'List active estimate sessions (waiting or voting)',
  })
  @ApiResponse({ status: 200, description: 'Active session list' })
  getActiveSessions(@Session() session: SessionUser) {
    return this.estimatesService.getActiveSessions(session.user.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'List completed estimate sessions (paginated, role-scoped)',
  })
  @ApiResponse({ status: 200, description: 'Completed session history' })
  getHistory(
    @Session() session: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('teamId') teamId?: string,
    @Query('search') search?: string,
  ) {
    return this.estimatesReportService.getHistory(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 15,
      teamId,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single estimate session with participants and votes',
  })
  @ApiResponse({ status: 200, description: 'Session detail' })
  getSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.estimatesService.getSession(session.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new estimate session' })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @ApiBody({ type: CreateEstimateSessionBody })
  @UsePipes(new ZodValidationPipe(CreateEstimateSessionSchema))
  createSession(
    @Session() session: SessionUser,
    @Body() body: CreateEstimateSessionDto,
  ) {
    return this.estimatesService
      .createSession(session.user.id, body)
      .then((result) => {
        this.syncSession(result.id);
        return result;
      });
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an estimate session as a participant' })
  async joinSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.upsertParticipant(
      id,
      session.user.id,
      true,
    );
    this.syncSession(id);
    return result;
  }

  // ==========================================================================
  // Convex-only REST write path (Phase 2 of socket-io-elimination-plan).
  // These mirror the gateway commands 1:1 with the same authorization the
  // gateway applied inline, then push state to Convex via the projection-sync
  // service (the polls pattern) rather than through the Socket.IO gateway. They
  // coexist with the gateway until Phase 4 deletes it, and are wired into the UI
  // in Phase 3. The pre-existing REST endpoints above (`/votes`, `/rounds/start`,
  // `DELETE /:id`, `/join`) remain the active socket-mode path for now.
  // ==========================================================================

  @Post(':id/participant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle participant presence (join/leave) — session members only',
  })
  @ApiParam({ name: 'id', description: 'Estimate session ID' })
  @ApiBody({ type: ParticipantPresenceBody })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(ParticipantPresenceSchema))
  async setParticipantPresence(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ParticipantPresenceDto,
  ) {
    await this.assertSessionMember(id, session.user.id);
    await this.estimatesService.upsertParticipant(
      id,
      session.user.id,
      body.online,
    );
    this.syncSession(id);
    return { success: true };
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cast a vote in the current round — session members only',
  })
  @ApiParam({ name: 'id', description: 'Estimate session ID' })
  @ApiBody({ type: CastVoteBody })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(CastVoteSchema))
  async castVoteRest(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CastVoteDto,
  ) {
    await this.assertSessionMember(id, session.user.id);
    await this.estimatesService.upsertVote(id, session.user.id, body.points);
    // Vote values stay masked in the projection until reveal — do not echo the
    // cast value back here (the gateway only emitted { voterId }).
    this.syncSession(id);
    return { success: true };
  }

  @Post(':id/round')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a new estimate round (creator or team lead only)',
  })
  @ApiParam({ name: 'id', description: 'Estimate session ID' })
  @ApiBody({ type: NewEstimateRoundBody })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(NewEstimateRoundSchema))
  async startRoundRest(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NewEstimateRoundDto,
  ) {
    await this.assertCanControl(id, session.user.id);
    await this.estimatesService.startRound(id, session.user.id, body);
    this.syncSession(id);
    return { success: true };
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the estimate session (manager only)' })
  @ApiParam({ name: 'id', description: 'Estimate session ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async endSessionRest(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertCanManage(id, session.user.id);
    await this.estimatesService.endSession(id, session.user.id);
    this.syncSession(id);
    return { success: true };
  }

  @Post(':id/votes')
  @ApiOperation({ summary: 'Cast a vote in an estimate session' })
  @ApiBody({ type: CastVoteBody })
  @UsePipes(new ZodValidationPipe(CastVoteSchema))
  async castVote(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CastVoteDto,
  ) {
    const result = await this.estimatesService.upsertVote(
      id,
      session.user.id,
      body.points,
    );
    this.syncSession(id);
    return result;
  }

  @Delete(':id/votes')
  @ApiOperation({
    summary: "Remove the current user's vote from an estimate session",
  })
  @ApiResponse({ status: 200, description: 'Vote removed' })
  async removeVote(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.removeVote(id, session.user.id);
    this.syncSession(id);
    return result;
  }

  @Post(':id/reveal')
  @ApiOperation({ summary: 'Reveal all votes in an estimate session' })
  async revealVotes(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.revealVotes(id, session.user.id);
    this.syncSession(id);
    return result;
  }

  @Post(':id/clear')
  @ApiOperation({ summary: 'Clear votes and start a new round' })
  @ApiBody({ type: NewEstimateRoundBody })
  @UsePipes(new ZodValidationPipe(NewEstimateRoundSchema))
  async clearVotes(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NewEstimateRoundDto,
  ) {
    const result = await this.estimatesService.clearVotes(
      id,
      session.user.id,
      body,
    );
    this.syncSession(id);
    return result;
  }

  @Post(':id/rounds/start')
  @ApiOperation({ summary: 'Start first or next round using ticket number' })
  @ApiBody({ type: NewEstimateRoundBody })
  @UsePipes(new ZodValidationPipe(NewEstimateRoundSchema))
  async startRound(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NewEstimateRoundDto,
  ) {
    const result = await this.estimatesService.startRound(
      id,
      session.user.id,
      body,
    );
    this.syncSession(id);
    return result;
  }

  @Patch(':id/story')
  @ApiOperation({ summary: 'Update the current story being estimated' })
  @ApiBody({ type: UpdateEstimateStoryBody })
  @UsePipes(new ZodValidationPipe(UpdateEstimateStorySchema))
  async updateStory(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEstimateStoryDto,
  ) {
    const result = await this.estimatesService.updateStory(
      id,
      session.user.id,
      body,
    );
    this.syncSession(id);
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session name' })
  @ApiBody({ type: UpdateSessionNameBody })
  @UsePipes(new ZodValidationPipe(UpdateSessionNameSchema))
  async updateSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSessionNameDto,
  ) {
    const result = await this.estimatesService.updateSessionName(
      id,
      session.user.id,
      body.name,
    );
    this.syncSession(id);
    return result;
  }

  @Post(':id/timer')
  @ApiOperation({ summary: 'Start a countdown timer for the session' })
  @ApiBody({ type: EstimateStartTimerBody })
  @UsePipes(new ZodValidationPipe(StartTimerSchema))
  async startTimer(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StartTimerDto,
  ) {
    const result = await this.estimatesService.startTimer(
      id,
      session.user.id,
      body.duration,
    );
    this.syncSession(id);
    return result;
  }

  @Patch(':id/consensus')
  @ApiOperation({
    summary: 'Set the agreed points for the current revealed round',
  })
  @ApiBody({ type: SetConsensusBody })
  @UsePipes(new ZodValidationPipe(SetConsensusSchema))
  async setConsensus(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetConsensusDto,
  ) {
    const result = await this.estimatesService.setConsensus(
      id,
      session.user.id,
      body.agreedPoints,
    );
    this.syncSession(id);
    return result;
  }

  @Post(':id/revote')
  @ApiOperation({
    summary: 'Clear votes and reopen the current round for re-voting',
  })
  async revote(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.revote(id, session.user.id);
    this.syncSession(id);
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'End and delete an estimate session' })
  async endSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.endSession(id, session.user.id);
    this.syncSession(id);
    return result;
  }

  @Delete(':id/permanent')
  @ApiOperation({
    summary: 'Permanently delete an estimate session from history',
  })
  async deleteSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.estimatesService.deleteSession(id, session.user.id);
  }

  @Post(':id/send-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Email the story estimate report to team members or specific addresses',
  })
  @ApiParam({ name: 'id', description: 'Estimate session ID' })
  @ApiBody({ type: SendEstimateReportDtoClass })
  @UsePipes(new ZodValidationPipe(sendEstimateReportSchema))
  sendReport(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendEstimateReportDto,
  ) {
    return this.estimatesReportService.sendEstimateReport(
      session.user.id,
      id,
      body,
    );
  }
}
