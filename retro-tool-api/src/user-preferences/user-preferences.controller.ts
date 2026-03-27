import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { UserPreferencesService } from './user-preferences.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { updateUserPreferencesSchema, UpdateUserPreferencesDto } from './dto';
import type { SessionUser } from '../common/types';

@ApiTags('user-preferences')
@Controller('user-preferences')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  /**
   * Get current user's notification preferences
   */
  @Get()
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'Returns user preferences' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPreferences(@Session() session: SessionUser) {
    return this.userPreferencesService.getUserPreferences(session.user.id);
  }

  /**
   * Update current user's notification preferences
   */
  @Patch()
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ZodValidationPipe(updateUserPreferencesSchema))
  async updateUserPreferences(
    @Body() body: UpdateUserPreferencesDto,
    @Session() session: SessionUser,
  ) {
    return this.userPreferencesService.updateUserPreferences(
      session.user.id,
      body,
    );
  }
}
