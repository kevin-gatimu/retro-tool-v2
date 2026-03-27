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
import { WeeklyDigestsService } from './weekly-digests.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUser } from '../common/types';
import {
  createWeeklyDigestSchema,
  CreateWeeklyDigestDto,
  CreateWeeklyDigestDtoClass,
  updateWeeklyDigestSchema,
  UpdateWeeklyDigestDto,
  UpdateWeeklyDigestDtoClass,
} from './dto';

@ApiTags('Weekly Digests')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('digests')
export class WeeklyDigestsController {
  constructor(private readonly weeklyDigestsService: WeeklyDigestsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createWeeklyDigestSchema))
  @ApiOperation({ summary: 'Create a weekly digest configuration' })
  @ApiBody({ type: CreateWeeklyDigestDtoClass })
  @ApiResponse({ status: 201, description: 'Digest configuration created' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  createDigest(
    @Body() body: CreateWeeklyDigestDto,
    @Session() session: SessionUser,
  ) {
    return this.weeklyDigestsService.createDigest(session.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get digest configurations for a team' })
  @ApiQuery({ name: 'teamId', type: String })
  @ApiResponse({ status: 200, description: 'List of digest configurations' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  getTeamDigests(
    @Query('teamId', ParseUUIDPipe) teamId: string,
    @Session() session: SessionUser,
  ) {
    return this.weeklyDigestsService.getTeamDigests(session.user.id, teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a digest configuration by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Digest configuration details' })
  @ApiResponse({ status: 404, description: 'Digest not found' })
  getDigest(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.weeklyDigestsService.getDigest(session.user.id, id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateWeeklyDigestSchema))
  @ApiOperation({ summary: 'Update a digest configuration' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateWeeklyDigestDtoClass })
  @ApiResponse({ status: 200, description: 'Digest configuration updated' })
  @ApiResponse({ status: 403, description: 'Only creator can update' })
  @ApiResponse({ status: 404, description: 'Digest not found' })
  updateDigest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWeeklyDigestDto,
    @Session() session: SessionUser,
  ) {
    return this.weeklyDigestsService.updateDigest(session.user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a digest configuration' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Digest configuration deleted' })
  @ApiResponse({ status: 403, description: 'Only creator can delete' })
  @ApiResponse({ status: 404, description: 'Digest not found' })
  deleteDigest(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.weeklyDigestsService.deleteDigest(session.user.id, id);
  }
}
