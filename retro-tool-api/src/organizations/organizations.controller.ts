import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  ParseBoolPipe,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { OrganizationsService } from './organizations.service';
import {
  createOrganizationSchema,
  CreateOrganizationDto,
  updateOrganizationSchema,
  UpdateOrganizationDto,
  addMemberSchema,
  AddMemberDto,
  updateMemberRoleSchema,
  UpdateMemberRoleDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUser } from '../common/types';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // Any authenticated user can create an organization
  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ZodValidationPipe(createOrganizationSchema))
  async createOrganization(
    @Body() body: CreateOrganizationDto,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.createOrganization(
      session.user.id,
      body,
    );
  }

  // Any authenticated user can list their organizations
  @Get()
  async getOrganizations(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('all', new ParseBoolPipe({ optional: true })) all: boolean = false,
    @Session() session: SessionUser,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    if (all) {
      return await this.organizationsService.getAllOrganizations(
        session.user.id,
        page,
        limit,
        search,
        sort,
        sortOrder,
      );
    }

    return await this.organizationsService.getUserOrganizations(
      session.user.id,
      page,
      limit,
      search,
    );
  }

  // Org membership validated in service
  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Returns organization details' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not a member of this organization',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.getOrganizationById(
      session.user.id,
      id,
    );
  }

  // Authorization validated in service (system-admin or org admin)
  @Patch(':id')
  @ApiOperation({ summary: 'Update organization (owner/admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization owner/admin access required',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  async updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrganizationDto,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.updateOrganization(
      session.user.id,
      id,
      body,
    );
  }

  // Authorization validated in service (system-admin or org owner)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization (owner only)' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Organization deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization owner access required',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async deleteOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.deleteOrganization(
      session.user.id,
      id,
    );
  }

  // Org membership validated in service
  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter by name or email',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of organization members',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not a member of this organization',
  })
  async getOrganizationMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('search') search: string | undefined,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.getOrganizationMembers(
      session.user.id,
      id,
      page,
      limit,
      search,
    );
  }

  // Authorization validated in service (system-admin or org admin)
  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to organization (owner/admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization owner/admin access required',
  })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  @UsePipes(new ZodValidationPipe(addMemberSchema))
  async addOrganizationMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddMemberDto,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.addOrganizationMember(
      session.user.id,
      id,
      body,
    );
  }

  // Authorization validated in service (system-admin or org admin)
  @Delete(':orgId/members/:memberId')
  @ApiOperation({
    summary: 'Remove member from organization (owner/admin only)',
  })
  @ApiParam({ name: 'orgId', type: String, description: 'Organization ID' })
  @ApiParam({ name: 'memberId', type: String, description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization owner/admin access required',
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeOrganizationMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.removeOrganizationMember(
      session.user.id,
      orgId,
      memberId,
    );
  }

  // Authorization validated in service (system-admin or org owner)
  @Patch(':orgId/members/:memberId/role')
  @UsePipes(new ZodValidationPipe(updateMemberRoleSchema))
  async updateOrganizationMemberRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: UpdateMemberRoleDto,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.updateOrganizationMemberRole(
      session.user.id,
      orgId,
      memberId,
      body.role,
    );
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave an organization (self)' })
  @ApiParam({ name: 'id', type: String, description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Left organization successfully' })
  @ApiResponse({ status: 403, description: 'Owner cannot leave' })
  async leaveOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return await this.organizationsService.leaveOrganization(
      session.user.id,
      id,
    );
  }
}
