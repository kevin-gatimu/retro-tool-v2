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
import { StandupsGateway } from '../standups/standups.gateway';
import type { SessionUser } from '../common/types';
import {
  createPollSchema,
  CreatePollDto,
  CreatePollDtoClass,
  votePollSchema,
  VotePollDto,
  VotePollDtoClass,
} from './dtos';

@ApiTags('polls')
@Controller('polls')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly standupsGateway: StandupsGateway,
  ) {}

  /** Standup-attached polls live inside the daily room's realtime feed. */
  private emitIfAttached(result: {
    standupId: string | null;
    entryDate: string | null;
  }): void {
    if (result.standupId && result.entryDate) {
      this.standupsGateway.emitEntryChanged(result.standupId, result.entryDate);
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
    this.emitIfAttached(result);
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
    this.emitIfAttached(result);
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
    this.emitIfAttached(result);
    return { success: true };
  }

  @Patch(':id/closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close or reopen a poll (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Poll ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async setClosed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isClosed') isClosed: boolean,
    @Session() session: SessionUser,
  ) {
    const result = await this.pollsService.setClosed(
      session.user.id,
      id,
      isClosed === true,
    );
    this.emitIfAttached(result);
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
    this.emitIfAttached(result);
    return { success: true };
  }
}
