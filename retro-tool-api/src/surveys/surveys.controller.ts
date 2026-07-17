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
import { SurveysQueryService } from './surveys-query.service';
import { SurveysEmailService } from './surveys-email.service';
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
  sendSurveyEmailSchema,
  SendSurveyEmailDto,
  SendSurveyEmailDtoClass,
  setSurveyClosedSchema,
  SetSurveyClosedDto,
  SetSurveyClosedDtoClass,
} from './dtos';

@ApiTags('surveys')
@Controller('surveys')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class SurveysController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly surveysQueryService: SurveysQueryService,
    private readonly surveysEmailService: SurveysEmailService,
    private readonly surveysProjectionSync: SurveysProjectionSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List surveys visible to the current user' })
  @ApiResponse({ status: 200, description: 'Survey list' })
  getSurveys(@Session() session: SessionUser) {
    return this.surveysQueryService.getSurveys(session.user.id);
  }

  @Get('active-count')
  @ApiOperation({
    summary: 'Count of open surveys the user has not answered yet',
  })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  getActiveCount(@Session() session: SessionUser) {
    return this.surveysQueryService.getActiveCount(session.user.id);
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
    return this.surveysQueryService.getSurvey(session.user.id, id);
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

  @Post(':id/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Email the survey results to its audience (manager only). Recipients, if given, are restricted to the survey scope.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiBody({ type: SendSurveyEmailDtoClass })
  @ApiResponse({ status: 200, description: '{ sent: number }' })
  @UsePipes(new ZodValidationPipe(sendSurveyEmailSchema))
  emailResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendSurveyEmailDto,
    @Session() session: SessionUser,
  ) {
    return this.surveysEmailService.emailResults(
      session.user.id,
      id,
      dto.recipients,
    );
  }

  @Patch(':id/closed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close or reopen a survey (manager only)' })
  @ApiParam({ name: 'id', type: String, description: 'Survey ID' })
  @ApiBody({ type: SetSurveyClosedDtoClass })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(setSurveyClosedSchema))
  async setClosed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSurveyClosedDto,
    @Session() session: SessionUser,
  ) {
    const result = await this.surveysService.setClosed(
      session.user.id,
      id,
      dto.isClosed,
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
