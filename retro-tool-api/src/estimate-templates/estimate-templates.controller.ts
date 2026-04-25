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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EstimateTemplatesService } from './estimate-templates.service';
import {
  CreateEstimateTemplateSchema,
  CreateEstimateTemplateBody,
  UpdateEstimateTemplateSchema,
  UpdateEstimateTemplateBody,
} from './dtos';
import type { SessionUser } from '../common/types';

@ApiTags('estimate-templates')
@Controller('estimates/templates')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class EstimateTemplatesController {
  constructor(
    private readonly estimateTemplatesService: EstimateTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated estimate templates' })
  @ApiResponse({
    status: 200,
    description: 'Paginated estimate templates with values',
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

    return this.estimateTemplatesService.getTemplatesPaginated(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 12,
      validType,
      search,
      sort,
      validSortOrder,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get estimate template by ID with values' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Template with values' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getTemplateById(@Param('id', ParseUUIDPipe) id: string) {
    return this.estimateTemplatesService.getTemplateById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an estimate template' })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UsePipes(new ZodValidationPipe(CreateEstimateTemplateSchema))
  async createTemplate(
    @Body() body: CreateEstimateTemplateBody,
    @Session() session: SessionUser,
  ) {
    return this.estimateTemplatesService.createTemplate(session.user.id, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an estimate template' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @UsePipes(new ZodValidationPipe(UpdateEstimateTemplateSchema))
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEstimateTemplateBody,
    @Session() session: SessionUser,
  ) {
    return this.estimateTemplatesService.updateTemplate(
      session.user.id,
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an estimate template' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.estimateTemplatesService.deleteTemplate(session.user.id, id);
  }

  @Post('seed')
  @Roles(['super-admin', 'system-admin'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed built-in estimate templates (admin only)' })
  @ApiResponse({
    status: 200,
    description: '{ seeded: number, skipped: number }',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async seedBuiltInTemplates() {
    return this.estimateTemplatesService.seedBuiltInTemplates();
  }
}
