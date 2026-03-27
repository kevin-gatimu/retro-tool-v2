import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ActionItemsService } from './action-items.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUser } from '../common/types';
import {
  createActionItemSchema,
  CreateActionItemDto,
  CreateActionItemDtoClass,
  updateActionItemSchema,
  UpdateActionItemDto,
  UpdateActionItemDtoClass,
} from './dto';

@ApiTags('Action Items')
@ApiBearerAuth('session')
@UseGuards(AuthGuard)
@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItemsService: ActionItemsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createActionItemSchema))
  @ApiOperation({ summary: 'Create an action item for a retrospective' })
  @ApiBody({ type: CreateActionItemDtoClass })
  @ApiResponse({ status: 201, description: 'Action item created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Retrospective not found' })
  async createActionItem(
    @Body() body: CreateActionItemDto,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.createActionItem(session.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get action items for a retrospective' })
  @ApiQuery({ name: 'retroId', type: String })
  @ApiResponse({ status: 200, description: 'List of action items' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Retrospective not found' })
  async getActionItems(
    @Query('retroId', ParseUUIDPipe) retroId: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.getActionItems(session.user.id, retroId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an action item by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Action item details' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async getActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.getActionItem(session.user.id, id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateActionItemSchema))
  @ApiOperation({ summary: 'Update an action item' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateActionItemDtoClass })
  @ApiResponse({ status: 200, description: 'Action item updated' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async updateActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateActionItemDto,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.updateActionItem(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an action item' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Action item deleted' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async deleteActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.deleteActionItem(session.user.id, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to an action item' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async createActionItemComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.createActionItemComment(
      session.user.id,
      id,
      content,
    );
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an action item comment' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Not the comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteActionItemComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.deleteActionItemComment(session.user.id, id);
  }

  @Post(':id/likes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like an action item' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Action item liked' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async likeActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.likeActionItem(session.user.id, id);
  }

  @Delete(':id/likes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove like from an action item' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Action item unliked' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Action item not found' })
  async unlikeActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.actionItemsService.unlikeActionItem(session.user.id, id);
  }
}
