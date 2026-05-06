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
import { EstimatesGateway } from './estimates.gateway';
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
    private readonly estimatesGateway: EstimatesGateway,
  ) {}

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
    return this.estimatesService.getHistory(
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
  @UsePipes(new ZodValidationPipe(CreateEstimateSessionSchema))
  createSession(
    @Session() session: SessionUser,
    @Body() body: CreateEstimateSessionBody,
  ) {
    return this.estimatesService
      .createSession(session.user.id, body as CreateEstimateSessionDto)
      .then((result) => {
        this.estimatesGateway.emitSessionChanged(result.id);
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
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Post(':id/votes')
  @ApiOperation({ summary: 'Cast a vote in an estimate session' })
  async castVote(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('points') points: string,
  ) {
    const result = await this.estimatesService.upsertVote(
      id,
      session.user.id,
      points,
    );
    this.estimatesGateway.emitSessionChanged(id);
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
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Post(':id/reveal')
  @ApiOperation({ summary: 'Reveal all votes in an estimate session' })
  async revealVotes(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.revealVotes(id, session.user.id);
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Post(':id/clear')
  @ApiOperation({ summary: 'Clear votes and start a new round' })
  @UsePipes(new ZodValidationPipe(NewEstimateRoundSchema))
  async clearVotes(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NewEstimateRoundBody,
  ) {
    const result = await this.estimatesService.clearVotes(
      id,
      session.user.id,
      body as NewEstimateRoundDto,
    );
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Post(':id/rounds/start')
  @ApiOperation({ summary: 'Start first or next round using ticket number' })
  @UsePipes(new ZodValidationPipe(NewEstimateRoundSchema))
  async startRound(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NewEstimateRoundBody,
  ) {
    const result = await this.estimatesService.startRound(
      id,
      session.user.id,
      body as NewEstimateRoundDto,
    );
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Patch(':id/story')
  @ApiOperation({ summary: 'Update the current story being estimated' })
  @UsePipes(new ZodValidationPipe(UpdateEstimateStorySchema))
  async updateStory(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEstimateStoryBody,
  ) {
    const result = await this.estimatesService.updateStory(
      id,
      session.user.id,
      body as UpdateEstimateStoryDto,
    );
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session name' })
  async updateSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name: string,
  ) {
    const result = await this.estimatesService.updateSessionName(id, name);
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Post(':id/timer')
  @ApiOperation({ summary: 'Start a countdown timer for the session' })
  async startTimer(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('duration') duration: number,
  ) {
    const result = await this.estimatesService.startTimer(
      id,
      session.user.id,
      duration,
    );
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Patch(':id/consensus')
  @ApiOperation({
    summary: 'Set the agreed points for the current revealed round',
  })
  @UsePipes(new ZodValidationPipe(SetConsensusSchema))
  async setConsensus(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetConsensusBody,
  ) {
    const result = await this.estimatesService.setConsensus(
      id,
      session.user.id,
      (body as SetConsensusDto).agreedPoints,
    );
    this.estimatesGateway.emitSessionChanged(id);
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
    this.estimatesGateway.emitSessionChanged(id);
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'End and delete an estimate session' })
  async endSession(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.estimatesService.endSession(id, session.user.id);
    this.estimatesGateway.emitSessionChanged(id);
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
  async sendReport(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendEstimateReportDto,
  ) {
    return this.estimatesService.sendEstimateReport(session.user.id, id, body);
  }
}
