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
  Query,
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
import { StandupsQueryService } from './standups-query.service';
import { StandupsEntriesService } from './standups-entries.service';
import { StandupsSubmissionsService } from './standups-submissions.service';
import { StandupsReportService } from './standups-report.service';
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
  sendStandupReportSchema,
  SendStandupReportDto,
  SendStandupReportDtoClass,
} from './dtos';

@ApiTags('standups')
@Controller('standups')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class StandupsController {
  constructor(
    private readonly standupsService: StandupsService,
    private readonly standupsQueryService: StandupsQueryService,
    private readonly standupsEntriesService: StandupsEntriesService,
    private readonly standupsSubmissionsService: StandupsSubmissionsService,
    private readonly standupsReportService: StandupsReportService,
    private readonly standupsProjectionSyncService: StandupsProjectionSyncService,
  ) {}

  // ============================================================================
  // Standup CRUD
  // ============================================================================

  @Get()
  @ApiOperation({ summary: "List standups for the current user's teams" })
  @ApiResponse({ status: 200, description: 'Standup list' })
  getStandups(@Session() session: SessionUser) {
    return this.standupsQueryService.getStandups(session.user.id);
  }

  @Get('activity')
  @ApiOperation({
    summary:
      'Entry dates with submission counts for the user\u2019s standups in a date range',
  })
  @ApiResponse({
    status: 200,
    description: '[{ standupId, entryDate, submissionCount }]',
  })
  getActivity(
    @Session() session: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.standupsQueryService.getActivity(session.user.id, from, to);
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
    await this.standupsProjectionSyncService.enqueueStandupDelete(id);
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
    return this.standupsEntriesService.getEntryDetail(
      session.user.id,
      id,
      date,
    );
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
    const result = await this.standupsSubmissionsService.upsertSubmission(
      session.user.id,
      id,
      date,
      body,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(id, date);
    return result;
  }

  @Delete(':id/entries/:date/submission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete the current user's submission for a date" })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiParam({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '{ entryId: string }' })
  async deleteSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsSubmissionsService.deleteSubmission(
      session.user.id,
      id,
      date,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(id, date);
    return result;
  }

  @Post(':id/skip-days/:date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip a standup day (creator/lead/admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiParam({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async skipDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.skipDay(
      session.user.id,
      id,
      date,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(id, date);
    return result;
  }

  @Delete(':id/skip-days/:date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a skipped standup day' })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiParam({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async unskipDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.standupsService.unskipDay(
      session.user.id,
      id,
      date,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(id, date);
    return result;
  }

  @Post(':id/send-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email a standup day report to team members or specific addresses',
  })
  @ApiParam({ name: 'id', type: String, description: 'Standup ID' })
  @ApiBody({ type: SendStandupReportDtoClass })
  @ApiResponse({ status: 200, description: '{ sent: number }' })
  @UsePipes(new ZodValidationPipe(sendStandupReportSchema))
  async sendReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStandupReportDto,
    @Session() session: SessionUser,
  ) {
    return this.standupsReportService.sendStandupReport(
      session.user.id,
      id,
      body,
    );
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
    const result = await this.standupsSubmissionsService.addComment(
      session.user.id,
      submissionId,
      body,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(
      result.standupId,
      result.date,
    );
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
    const result = await this.standupsSubmissionsService.deleteComment(
      session.user.id,
      commentId,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(
      result.standupId,
      result.date,
    );
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
    const result = await this.standupsSubmissionsService.addReaction(
      session.user.id,
      submissionId,
      body.emoji,
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(
      result.standupId,
      result.date,
    );
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
    const result = await this.standupsSubmissionsService.removeReaction(
      session.user.id,
      submissionId,
      decodeURIComponent(emoji),
    );
    await this.standupsProjectionSyncService.enqueueEntrySync(
      result.standupId,
      result.date,
    );
    return { success: true };
  }
}
