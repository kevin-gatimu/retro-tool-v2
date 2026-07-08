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
import { SurveysService } from './surveys.service';
import { SurveysProjectionSyncService } from './surveys-projection-sync.service';
import type { SessionUser } from '../common/types';
import {
  createSurveySchema,
  CreateSurveyDto,
  CreateSurveyDtoClass,
  respondSurveySchema,
  RespondSurveyDto,
  RespondSurveyDtoClass,
  updateSurveySchema,
  UpdateSurveyDto,
  UpdateSurveyDtoClass,
} from './dtos';

@ApiTags('surveys')
@Controller('surveys')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class SurveysController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly surveysProjectionSync: SurveysProjectionSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List surveys visible to the current user' })
  @ApiResponse({ status: 200, description: 'Survey list' })
  getSurveys(@Session() session: SessionUser) {
    return this.surveysService.getSurveys(session.user.id);
  }

  @Get('active-count')
  @ApiOperation({
    summary: 'Count of open surveys the user has not answered yet',
  })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  getActiveCount(@Session() session: SessionUser) {
    return this.surveysService.getActiveCount(session.user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a survey (team: lead+, org: org admin+, system: system admin+)',
  })
  @ApiBody({ type: CreateSurveyDtoClass })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @UsePipes(new ZodValidationPipe(createSurveySchema))
  async createSurvey(
    @Body() body: CreateSurveyDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.createSurvey(
      session.user.id,
      body,
    );
    void this.surveysProjectionSync.syncSurveyProjection(result.id);
    return result;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Survey detail with questions (+results when permitted)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiResponse({ status: 200, description: 'Survey detail' })
  getSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.surveysService.getSurvey(session.user.id, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Edit a survey — title, description, questions (creator or system admin)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiBody({ type: UpdateSurveyDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(updateSurveySchema))
  async updateSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSurveyDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.updateSurvey(
      session.user.id,
      id,
      body,
    );
    void this.surveysProjectionSync.syncSurveyProjection(id);
    return result;
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit answers (one response per user)' })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiBody({ type: RespondSurveyDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(respondSurveySchema))
  async respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RespondSurveyDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.respond(session.user.id, id, body);
    void this.surveysProjectionSync.syncSurveyProjection(id);
    return result;
  }

  @Patch(':id/closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close or reopen a survey (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async setClosed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isClosed') isClosed: boolean,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.setClosed(
      session.user.id,
      id,
      isClosed === true,
    );
    void this.surveysProjectionSync.syncSurveyProjection(id);
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a survey (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async deleteSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.deleteSurvey(session.user.id, id);
    void this.surveysProjectionSync.deleteSurveyProjection(id);
    return result;
  }
}
