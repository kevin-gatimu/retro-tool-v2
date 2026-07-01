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
import { IcebreakerTemplatesService } from './icebreaker-templates.service';
import {
  CreateIcebreakerTemplateSchema,
  CreateIcebreakerTemplateBody,
  UpdateIcebreakerTemplateSchema,
  UpdateIcebreakerTemplateBody,
} from './dtos';
import { ICEBREAKER_FLAVOURS, type TIcebreakerFlavour } from '../common/enums';
import type { SessionUser } from '../common/types';

@ApiTags('icebreaker-templates')
@Controller('icebreakers/templates')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class IcebreakerTemplatesController {
  constructor(
    private readonly icebreakerTemplatesService: IcebreakerTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated icebreaker templates' })
  @ApiResponse({
    status: 200,
    description: 'Paginated icebreaker templates with prompts',
  })
  async getTemplates(
    @Session() session: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('flavour') flavour?: string,
  ) {
    const validType =
      type === 'built-in' || type === 'organization' ? type : undefined;
    const validSortOrder =
      sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'asc';
    const validFlavour = (
      [
        ICEBREAKER_FLAVOURS.Fun,
        ICEBREAKER_FLAVOURS.Professional,
        ICEBREAKER_FLAVOURS.Creative,
      ] as string[]
    ).includes(flavour ?? '')
      ? (flavour as TIcebreakerFlavour)
      : undefined;

    return this.icebreakerTemplatesService.getTemplatesPaginated(
      session.user.id,
      page ? Math.max(1, parseInt(page, 10)) : 1,
      limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 12,
      validType,
      search,
      sort,
      validSortOrder,
      validFlavour,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get icebreaker template by ID with prompts' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Template with prompts' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getTemplateById(@Param('id', ParseUUIDPipe) id: string) {
    return this.icebreakerTemplatesService.getTemplateById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an icebreaker template' })
  @ApiResponse({ status: 201, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UsePipes(new ZodValidationPipe(CreateIcebreakerTemplateSchema))
  async createTemplate(
    @Body() body: CreateIcebreakerTemplateBody,
    @Session() session: SessionUser,
  ) {
    return this.icebreakerTemplatesService.createTemplate(
      session.user.id,
      body,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an icebreaker template' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '{ id: string }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @UsePipes(new ZodValidationPipe(UpdateIcebreakerTemplateSchema))
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateIcebreakerTemplateBody,
    @Session() session: SessionUser,
  ) {
    return this.icebreakerTemplatesService.updateTemplate(
      session.user.id,
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an icebreaker template' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.icebreakerTemplatesService.deleteTemplate(session.user.id, id);
  }

  @Post('seed')
  @Roles(['super-admin', 'system-admin'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed built-in icebreaker templates (admin only)' })
  @ApiResponse({
    status: 200,
    description: '{ seeded: number, skipped: number }',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async seedBuiltInTemplates() {
    return this.icebreakerTemplatesService.seedBuiltInTemplates();
  }
}
