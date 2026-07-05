import {
  Controller,
  Get,
  Post,
  Put,
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
import { StandupsService } from './standups.service';
import { StandupsGateway } from './standups.gateway';
import { StandupsProjectionSyncService } from './standups-projection-sync.service';
import type { SessionUser } from '../common/types';
import {
  createStandupSchema,
  CreateStandupDto,
  CreateStandupDtoClass,
  updateStandupSchema,
  UpdateStandupDto,
  UpdateStandupDtoClass,
  submitStandupSchema,
  SubmitStandupDto,
  SubmitStandupDtoClass,
  createStandupCommentSchema,
  CreateStandupCommentDto,
  CreateStandupCommentDtoClass,
  addStandupReactionSchema,
  AddStandupReactionDto,
  AddStandupReactionDtoClass,
} from './dtos';

@ApiTags('standups')
@Controller('standups')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class StandupsController {
  constructor(
    private readonly standupsService: StandupsService,
    private readonly standupsGateway: StandupsGateway,
    private readonly standupsProjectionSyncService: StandupsProjectionSyncService,
  ) {}

  // ============================================================================
  // Standup CRUD
  // ============================================================================

  @Get()
  @ApiOperation({ summary: "List standups for the current user's teams" })
  @ApiResponse({ status: 200, description: 'Standup list' })
  getStandups(@Session() session: SessionUser) {
    return this.standupsService.getStandups(session.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new standup for a team' })
  @ApiBody({ type: CreateStandupDtoClass })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a team member' })
  @UsePipes(new ZodValidationPipe(createStandupSchema))
  async createStandup(
    @Body() body: CreateStandupDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.createStandup(
      session.user.id,
      body,
    );
    this.standupsGateway.emitStandupListChanged();
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get standup configuration with questions' })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiResponse({ status: 200, description: 'Standup detail' })
  @ApiResponse({ status: 404, description: 'Standup not found' })
  getStandup(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.standupsService.getStandup(session.user.id, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a standup (creator, team lead, or admin only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiBody({ type: UpdateStandupDtoClass })
  @ApiResponse({ status: 200, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UsePipes(new ZodValidationPipe(updateStandupSchema))
  async updateStandup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStandupDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.updateStandup(
      session.user.id,
      id,
      body,
    );
    this.standupsGateway.emitStandupChanged(id);
    this.standupsGateway.emitStandupListChanged();
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a standup (creator, team lead, or admin only)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteStandup(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.deleteStandup(
      session.user.id,
      id,
    );
    await this.standupsProjectionSyncService.deleteStandupProjection(id);
    this.standupsGateway.emitStandupListChanged();
    return result;
  }

  // ============================================================================
  // Daily entries (persistent rooms)
  // ============================================================================

  @Get(':id/entries/:date')
  @ApiOperation({
    summary: 'Get the daily standup room for a date (with submissions)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiParam({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Entry detail' })
  getEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Session() session: SessionUser,
  ) {
    return this.standupsService.getEntryDetail(session.user.id, id, date);
  }

  @Put(':id/entries/:date/submission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create or update the current user's submission" })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiParam({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiBody({ type: SubmitStandupDtoClass })
  @ApiResponse({
    status: 200,
    description: '{ submissionId: string, entryId: string }',
  })
  @UsePipes(new ZodValidationPipe(submitStandupSchema))
  async upsertSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Body() body: SubmitStandupDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.upsertSubmission(
      session.user.id,
      id,
      date,
      body,
    );
    this.standupsGateway.emitEntryChanged(id, date);
    return result;
  }

  // ============================================================================
  // Comments
  // ============================================================================

  @Post('submissions/:submissionId/comments')
  @ApiOperation({ summary: 'Add a comment to a submission' })
  @ApiParam({ name: 'submissionId', type: String })
  @ApiBody({ type: CreateStandupCommentDtoClass })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @UsePipes(new ZodValidationPipe(createStandupCommentSchema))
  async addComment(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: CreateStandupCommentDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.addComment(
      session.user.id,
      submissionId,
      body,
    );
    this.standupsGateway.emitEntryChanged(result.standupId, result.date);
    return { id: result.id };
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment (author or manager only)' })
  @ApiParam({ name: 'commentId', type: String })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async deleteComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.deleteComment(
      session.user.id,
      commentId,
    );
    this.standupsGateway.emitEntryChanged(result.standupId, result.date);
    return { success: true };
  }

  // ============================================================================
  // Reactions
  // ============================================================================

  @Post('submissions/:submissionId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add an emoji reaction to a submission' })
  @ApiParam({ name: 'submissionId', type: String })
  @ApiBody({ type: AddStandupReactionDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(addStandupReactionSchema))
  async addReaction(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: AddStandupReactionDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.addReaction(
      session.user.id,
      submissionId,
      body.emoji,
    );
    this.standupsGateway.emitEntryChanged(result.standupId, result.date);
    return { success: true };
  }

  @Delete('submissions/:submissionId/reactions/:emoji')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an emoji reaction from a submission' })
  @ApiParam({ name: 'submissionId', type: String })
  @ApiParam({ name: 'emoji', type: String })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async removeReaction(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Param('emoji') emoji: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.removeReaction(
      session.user.id,
      submissionId,
      decodeURIComponent(emoji),
    );
    this.standupsGateway.emitEntryChanged(result.standupId, result.date);
    return { success: true };
  }
}
