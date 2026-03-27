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
import { RetroRemindersService } from './retro-reminders.service';
import {
  CreateRetroReminderDtoClass,
  UpdateRetroReminderDtoClass,
} from './dto';
import type { SessionUser } from '../common/types';

@ApiTags('Retro Reminders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reminders')
export class RetroRemindersController {
  constructor(private readonly retroRemindersService: RetroRemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a retro reminder' })
  @ApiBody({ type: CreateRetroReminderDtoClass })
  @ApiResponse({ status: 201, description: 'Reminder created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async createReminder(
    @Body() body: CreateRetroReminderDtoClass,
    @Session() session: SessionUser,
  ) {
    return this.retroRemindersService.createReminder(session.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get reminders for a team' })
  @ApiQuery({ name: 'teamId', type: String })
  @ApiResponse({ status: 200, description: 'List of reminders' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async getTeamReminders(
    @Query('teamId', ParseUUIDPipe) teamId: string,
    @Session() session: SessionUser,
  ) {
    return this.retroRemindersService.getTeamReminders(session.user.id, teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reminder by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reminder details' })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  async getReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retroRemindersService.getReminder(session.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateRetroReminderDtoClass })
  @ApiResponse({ status: 200, description: 'Reminder updated' })
  @ApiResponse({ status: 403, description: 'Only creator can update' })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  async updateReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRetroReminderDtoClass,
    @Session() session: SessionUser,
  ) {
    return this.retroRemindersService.updateReminder(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a reminder' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Reminder deleted' })
  @ApiResponse({ status: 403, description: 'Only creator can delete' })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  async deleteReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.retroRemindersService.deleteReminder(session.user.id, id);
  }
}
