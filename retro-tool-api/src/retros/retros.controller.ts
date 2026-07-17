import {
  Controller,
  Get,
  Post,
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
import { AuthGuard, Roles, Session } from '@thallesp/nestjs-better-auth';
import { RetrosService } from './retros.service';
import { RetrosTemplatesService } from './retros-templates.service';
import { RetrosGateway } from './retros.gateway';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';
import {
  createRetroSchema,
  CreateRetroDto,
  CreateRetroDtoClass,
  createCardSchema,
  CreateCardDto,
  CreateCardDtoClass,
  updateCardSchema,
  UpdateCardDto,
  UpdateCardDtoClass,
  createCommentSchema,
  CreateCommentDto,
  CreateCommentDtoClass,
  mergeCardsSchema,
  MergeCardsDto,
  MergeCardsDtoClass,
  sendRetroReportSchema,
  SendRetroReportDto,
  SendRetroReportDtoClass,
} from './dtos';
import {
  createTemplateSchema,
  CreateTemplateDto,
  CreateTemplateDtoClass,
} from './dtos/create-template.dto';
import {
  updateTemplateSchema,
  UpdateTemplateDto,
  UpdateTemplateDtoClass,
} from './dtos/update-template.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUser } from '../common/types';

@ApiTags('retros')
@Controller('retros')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class RetrosController {
  constructor(
    private readonly retrosService: RetrosService,
    private readonly retrosTemplatesService: RetrosTemplatesService,
    private readonly retrosGateway: RetrosGateway,
    private readonly retrosProjectionSyncService: RetrosProjectionSyncService,
  ) {}

  // ============================================================================
  // Template Endpoints
  // ============================================================================

  @Get('templates')
  @ApiOperation({
    summary: 'Get paginated templates accessible to the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated templates with columns',
  })
  async getTemplates(
    @Session() session: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const validType =
      type === 'built-in' || type === 'organization' ? type : undefined;
    const validSortOrder =
      sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'asc';

    return this.retrosTemplatesService.getTemplatesPaginated(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 12,
      validType,
      search,
      sort,
      validSortOrder,
    );
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID with columns' })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Returns template with columns' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateById(@Param('id', ParseUUIDPipe) id: string) {
    return this.retrosTemplatesService.getTemplateById(id);
  }

  @Post('templates')
  @ApiOperation({
    summary: 'Create a template (system admin for global, org admin for org)',
  })
  @ApiBody({ type: CreateTemplateDtoClass })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @UsePipes(new ZodValidationPipe(createTemplateSchema))
  async createTemplate(
    @Body() body: CreateTemplateDto,
    @Session() session: SessionUser,
  ) {
    return this.retrosTemplatesService.createTemplate(session.user.id, body);
  }

  @Patch('templates/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a template (system admin or org admin for org templates)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiBody({ type: UpdateTemplateDtoClass })
  @ApiResponse({ status: 200, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @UsePipes(new ZodValidationPipe(updateTemplateSchema))
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateDto,
    @Session() session: SessionUser,
  ) {
    return this.retrosTemplatesService.updateTemplate(
      session.user.id,
      id,
      body,
    );
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a template (system admin or org admin for org templates)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retrosTemplatesService.deleteTemplate(session.user.id, id);
  }

  @Post('templates/seed')
  @Roles(['super-admin', 'system-admin'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed built-in templates (admin only)' })
  @ApiResponse({ status: 200, description: 'Templates seeded' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async seedBuiltInTemplates() {
    return this.retrosTemplatesService.seedBuiltInTemplates();
  }

  // ============================================================================
  // Dashboard Endpoint
  // ============================================================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics for the current user' })
  @ApiResponse({ status: 200, description: 'Returns dashboard stats' })
  async getDashboardStats(@Session() session: SessionUser) {
    return this.retrosService.getDashboardStats(session.user.id);
  }

  // ============================================================================
  // Retrospective Endpoints
  // ============================================================================

  @Get()
  @ApiOperation({ summary: 'Get recent retrospectives for the current user' })
  @ApiResponse({ status: 200, description: 'Returns recent retrospectives' })
  async getRecentRetros(
    @Session() session: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('teamId') teamId?: string,
    @Query('search') search?: string,
  ) {
    const normalizedStatus =
      status === 'ongoing' || status === 'completed' ? status : undefined;
    return this.retrosService.getRecentRetros(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 12,
      normalizedStatus,
      teamId,
      search,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new retrospective' })
  @ApiBody({ type: CreateRetroDtoClass })
  @ApiResponse({ status: 201, description: 'Retrospective created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @UsePipes(new ZodValidationPipe(createRetroSchema))
  async createRetro(
    @Body() body: CreateRetroDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.createRetro(session.user.id, body);
    this.retrosGateway.emitRetroChanged(result.id);
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a retrospective by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Returns the retrospective' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getRetro(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retrosService.getRetro(session.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a retrospective' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Retrospective deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteRetro(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.deleteRetro(session.user.id, id);
    await this.retrosProjectionSyncService.deleteRetroProjection(id);
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/lobby')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start the lobby/waiting phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Lobby started' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async startLobby(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.startLobby(session.user.id, id);
    this.retrosGateway.emitRetroStatusChanged(id, 'waiting');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start the retrospective (from lobby or draft)' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Retrospective started' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async startRetro(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.startRetro(session.user.id, id);
    this.retrosGateway.emitRetroStatusChanged(id, 'active');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/grouping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move retrospective to grouping phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Moved to grouping phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async moveToGrouping(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.moveToGrouping(session.user.id, id);
    this.retrosGateway.emitRetroStatusChanged(id, 'grouping');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/voting')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move retrospective to voting phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Moved to voting phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async moveToVoting(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.moveToVoting(session.user.id, id);
    this.retrosGateway.emitRetroStatusChanged(id, 'voting');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/discussion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move retrospective to discussion phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Moved to discussion phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async moveToDiscussion(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.moveToDiscussion(
      session.user.id,
      id,
    );
    this.retrosGateway.emitRetroStatusChanged(id, 'discussing');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete the retrospective' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Retrospective completed' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async completeRetro(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.completeRetro(session.user.id, id);
    this.retrosGateway.emitRetroStatusChanged(id, 'completed');
    this.retrosGateway.emitRetroListChanged();
    return result;
  }

  @Post(':id/send-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email the retro report to team members or specific addresses',
  })
  @ApiParam({ name: 'id', description: 'Retro ID' })
  @ApiBody({ type: SendRetroReportDtoClass })
  @UsePipes(new ZodValidationPipe(sendRetroReportSchema))
  async sendReport(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) retroId: string,
    @Body() body: SendRetroReportDto,
  ) {
    return this.retrosService.sendRetroReport(session.user.id, retroId, body);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a retrospective as participant' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'Joined retrospective' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async joinRetro(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.joinRetro(session.user.id, id);
    this.retrosGateway.emitRetroChanged(id);
    return result;
  }

  // ============================================================================
  // Card Endpoints
  // ============================================================================

  @Post('cards')
  @ApiOperation({ summary: 'Create a new card' })
  @ApiBody({ type: CreateCardDtoClass })
  @ApiResponse({ status: 201, description: 'Card created' })
  @ApiResponse({ status: 400, description: 'Cannot add cards in this phase' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Retrospective not found' })
  @UsePipes(new ZodValidationPipe(createCardSchema))
  async createCard(
    @Body() body: CreateCardDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.createCard(session.user.id, body);
    this.retrosGateway.emitRetroChanged(body.retroId);
    return result;
  }

  @Post(':id/merge-cards')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merge similar cards during grouping phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiBody({ type: MergeCardsDtoClass })
  @ApiResponse({ status: 200, description: 'Cards merged' })
  @ApiResponse({ status: 400, description: 'Invalid merge operation' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Card or retro not found' })
  @UsePipes(new ZodValidationPipe(mergeCardsSchema))
  async mergeCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MergeCardsDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.mergeCards(
      session.user.id,
      id,
      body,
    );
    this.retrosGateway.emitRetroChanged(id);
    return result;
  }

  @Post(':id/cards/:cardId/unmerge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unmerge a merged card during grouping phase' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiParam({ name: 'cardId', type: String, description: 'Merged card ID' })
  @ApiResponse({ status: 200, description: 'Card unmerged' })
  @ApiResponse({ status: 400, description: 'Invalid unmerge operation' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Card or retro not found' })
  async unmergeCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.unmergeCard(
      session.user.id,
      id,
      cardId,
    );
    this.retrosGateway.emitRetroChanged(id);
    return result;
  }

  @Patch('cards/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a card' })
  @ApiParam({ name: 'id', type: String, description: 'Card ID' })
  @ApiBody({ type: UpdateCardDtoClass })
  @ApiResponse({ status: 200, description: 'Card updated' })
  @ApiResponse({ status: 403, description: 'Not the card author' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  @UsePipes(new ZodValidationPipe(updateCardSchema))
  async updateCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCardDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.updateCard(
      session.user.id,
      id,
      body,
    );
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  @Delete('cards/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a card' })
  @ApiParam({ name: 'id', type: String, description: 'Card ID' })
  @ApiResponse({ status: 200, description: 'Card deleted' })
  @ApiResponse({ status: 403, description: 'Not the card author' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async deleteCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.deleteCard(session.user.id, id);
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  // ============================================================================
  // Voting Endpoints
  // ============================================================================

  @Post('cards/:id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vote for a card' })
  @ApiParam({ name: 'id', type: String, description: 'Card ID' })
  @ApiResponse({ status: 200, description: 'Vote recorded' })
  @ApiResponse({
    status: 400,
    description: 'Already voted or vote limit reached',
  })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async voteForCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.voteForCard(session.user.id, id);
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  @Delete('cards/:id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove vote from a card' })
  @ApiParam({ name: 'id', type: String, description: 'Card ID' })
  @ApiResponse({ status: 200, description: 'Vote removed' })
  @ApiResponse({ status: 400, description: 'Voting is not active' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async removeVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.removeVote(session.user.id, id);
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  // ============================================================================
  // Comment Endpoints
  // ============================================================================

  @Post('cards/:id/comments')
  @ApiOperation({ summary: 'Add a comment to a card' })
  @ApiParam({ name: 'id', type: String, description: 'Card ID' })
  @ApiBody({ type: CreateCommentDtoClass })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  @UsePipes(new ZodValidationPipe(createCommentSchema))
  async createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCommentDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.createComment(
      session.user.id,
      id,
      body,
    );
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', type: String, description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Not the comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.deleteComment(session.user.id, id);
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', type: String, description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  @ApiResponse({ status: 403, description: 'Not the comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.updateComment(
      session.user.id,
      id,
      content,
    );
    if (result.retroId) this.retrosGateway.emitRetroChanged(result.retroId);
    return result;
  }

  @Get(':id/action-items')
  @ApiOperation({ summary: 'Get action items for a retrospective' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 200, description: 'List of action items' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Retrospective not found' })
  async getRetroActionItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retrosService.getRetroActionItems(session.user.id, id);
  }

  @Post(':id/action-items')
  @ApiOperation({ summary: 'Create an action item for a retrospective' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({ status: 201, description: 'Action item created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async createActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { title: string; description?: string; isCarriedForward?: boolean },
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.createActionItem(
      session.user.id,
      id,
      body,
    );
    this.retrosGateway.emitRetroChanged(id);
    return result;
  }

  // ============================================================================
  // Discussion Endpoints
  // ============================================================================

  @Post(':id/cards/:cardId/discuss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the card currently being discussed' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiParam({ name: 'cardId', type: String, description: 'Card ID' })
  @ApiResponse({ status: 200, description: 'Current discussion card updated' })
  @ApiResponse({ status: 400, description: 'Not in discussing phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async setCurrentDiscussionCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.setCurrentDiscussionCard(
      session.user.id,
      id,
      cardId,
    );
    this.retrosGateway.emitDiscussionCardChanged(id, cardId);
    return result;
  }

  @Post(':id/action-items/:actionItemId/discuss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set the carried-forward action item currently being discussed',
  })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiParam({
    name: 'actionItemId',
    type: String,
    description: 'Action Item ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Current discussion action item updated',
  })
  @ApiResponse({ status: 400, description: 'Not in discussing phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async setCurrentDiscussionActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionItemId', ParseUUIDPipe) actionItemId: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.setCurrentDiscussionActionItem(
      session.user.id,
      id,
      actionItemId,
    );
    this.retrosGateway.emitDiscussionActionItemChanged(id, actionItemId);
    return result;
  }

  @Post(':id/cards/:cardId/mark-discussed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a card as discussed' })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiParam({ name: 'cardId', type: String, description: 'Card ID' })
  @ApiResponse({ status: 200, description: 'Card marked as discussed' })
  @ApiResponse({ status: 400, description: 'Not in discussing phase' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async markCardDiscussed(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.markCardDiscussed(
      session.user.id,
      id,
      cardId,
    );
    this.retrosGateway.emitRetroChanged(id);
    return result;
  }

  @Post(':id/carry-forward')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create action items for undiscussed cards (carry forward)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { cardIds: { type: 'array', items: { type: 'string' } } },
      required: ['cardIds'],
    },
  })
  @ApiResponse({ status: 200, description: '{ created: number }' })
  @ApiResponse({ status: 400, description: 'Retro not completed' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async carryForwardCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('cardIds') cardIds: string[],
    @Session() session: SessionUser,
  ) {
    const result = await this.retrosService.carryForwardCards(
      session.user.id,
      id,
      cardIds,
    );
    if (result.created > 0) {
      this.retrosGateway.emitRetroChanged(id);
    }
    return result;
  }

  @Get(':id/previous-carried-forward')
  @ApiOperation({
    summary: 'Get carried-forward action items from the previous retro',
  })
  @ApiParam({ name: 'id', type: String, description: 'Retrospective ID' })
  @ApiResponse({
    status: 200,
    description: 'List of carried-forward action items',
  })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async getPreviousCarriedForward(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retrosService.getPreviousCarriedForward(session.user.id, id);
  }
}
