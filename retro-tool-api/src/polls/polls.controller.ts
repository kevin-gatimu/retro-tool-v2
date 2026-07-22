import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PollsService } from './polls.service';
import { PollsProjectionSyncService } from './polls-projection-sync.service';
import { StandupsProjectionSyncService } from '../standups/standups-projection-sync.service';
import type { SessionUser } from '../common/types';
import {
  createPollSchema,
  CreatePollDto,
  CreatePollDtoClass,
  updatePollSchema,
  UpdatePollDto,
  UpdatePollDtoClass,
  votePollSchema,
  VotePollDto,
  VotePollDtoClass,
  emailPollResultsSchema,
  EmailPollResultsDto,
  EmailPollResultsDtoClass,
  setPollClosedSchema,
  SetPollClosedDto,
  SetPollClosedDtoClass,
} from './dtos';

@ApiTags('polls')
@Controller('polls')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly pollsProjectionSync: PollsProjectionSyncService,
    private readonly standupsProjectionSync: StandupsProjectionSyncService,
  ) {}

  /** Standup-attached polls live inside the daily room's realtime feed. */
  private async resyncStandupIfAttached(result: {
    standupId: string | null;
    entryDate: string | null;
  }): Promise<void> {
    if (result.standupId && result.entryDate) {
      await this.standupsProjectionSync.enqueueEntrySync(
        result.standupId,
        result.entryDate,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: "List standalone polls for the current user's teams",
  })
  @ApiResponse({ status: 200, description: 'Poll list' })
  getPolls(@Session() session: SessionUser) {
    return this.pollsService.getPolls(session.user.id);
  }

  @Get('active-count')
  @ApiOperation({
    summary: "Count of open polls the current user hasn't voted on yet",
  })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  getActiveCount(@Session() session: SessionUser) {
    return this.pollsService.getActiveCount(session.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a poll (standalone or standup-attached)' })
  @ApiBody({ type: CreatePollDtoClass })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @UsePipes(new ZodValidationPipe(createPollSchema))
  async createPoll(
    @Body() body: CreatePollDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.createPoll(session.user.id, body);
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollSync(result.id);
    return { id: result.id };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a poll with options, counts, and voters' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiResponse({ status: 200, description: 'Poll detail' })
  getPoll(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.pollsService.getPoll(session.user.id, id);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vote for an option (replaces any previous vote)' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiBody({ type: VotePollDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(votePollSchema))
  async vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VotePollDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.vote(
      session.user.id,
      id,
      body.optionId,
    );
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollSync(id);
    return { success: true };
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retract your vote' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async retractVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.retractVote(session.user.id, id);
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollSync(id);
    return { success: true };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit a poll — question, anonymity, and options (manager only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiBody({ type: UpdatePollDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(updatePollSchema))
  async updatePoll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePollDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.updatePoll(
      session.user.id,
      id,
      body,
    );
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollSync(id);
    return { success: true };
  }

  @Post(':id/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Email the poll results to its team (manager only). Recipients, if given, are restricted to team members.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiBody({ type: EmailPollResultsDtoClass })
  @ApiResponse({ status: 200, description: '{ sent: number }' })
  @UsePipes(new ZodValidationPipe(emailPollResultsSchema))
  emailResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmailPollResultsDto,
    @Session() session: SessionUser,
  ) {
    return this.pollsService.emailResults(session.user.id, id, body.recipients);
  }

  @Patch(':id/closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close or reopen a poll (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiBody({ type: SetPollClosedDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(setPollClosedSchema))
  async setClosed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetPollClosedDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.setClosed(
      session.user.id,
      id,
      body.isClosed,
    );
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollSync(id);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a poll (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async deletePoll(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.deletePoll(session.user.id, id);
    void this.resyncStandupIfAttached(result);
    void this.pollsProjectionSync.enqueuePollDelete(id);
    return { success: true };
  }
}
