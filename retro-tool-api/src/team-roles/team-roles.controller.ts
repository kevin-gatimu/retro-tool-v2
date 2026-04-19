import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { TeamRolesService } from './team-roles.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { SessionUser } from '../common/types';
import {
  createTeamRoleSchema,
  CreateTeamRoleDto,
  updateTeamRoleSchema,
  UpdateTeamRoleDto,
  createOrgTeamRoleSchema,
  CreateOrgTeamRoleDto,
  toggleRoleActivationSchema,
  ToggleRoleActivationDto,
} from './dto';

// ── System-level: built-in role management ───────────────────────────────────

@ApiTags('team-roles')
@Controller('team-roles')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class TeamRolesController {
  constructor(private readonly teamRolesService: TeamRolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all built-in team roles' })
  @ApiResponse({ status: 200, description: 'List of built-in team roles' })
  async listBuiltInRoles() {
    return this.teamRolesService.listBuiltInRoles();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createTeamRoleSchema))
  @ApiOperation({ summary: 'Create a built-in team role (system admin)' })
  @ApiResponse({ status: 201, description: 'Role created' })
  async createBuiltInRole(
    @Body() body: CreateTeamRoleDto,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.createBuiltInRole(session.user.id, body);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateTeamRoleSchema))
  @ApiOperation({ summary: 'Update a built-in team role (system admin)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateBuiltInRole(
    @Param('id') id: string,
    @Body() body: UpdateTeamRoleDto,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.updateBuiltInRole(session.user.id, id, body);
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed built-in team roles (system admin, idempotent)',
  })
  @ApiResponse({ status: 200, description: 'Seed result' })
  async seedBuiltInRoles(@Session() session: SessionUser) {
    return this.teamRolesService.seedBuiltInRoles(session.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a built-in team role (system admin)' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  @ApiResponse({ status: 409, description: 'Role is in use by team members' })
  async deleteBuiltInRole(
    @Param('id') id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.deleteBuiltInRole(session.user.id, id);
  }
}

// ── Org-level: org role management ────────────────────────────────────────────

@ApiTags('team-roles')
@Controller('organizations/:orgId/team-roles')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class OrgTeamRolesController {
  constructor(private readonly teamRolesService: TeamRolesService) {}

  @Get()
  @ApiOperation({ summary: 'List team roles available to an org' })
  @ApiResponse({
    status: 200,
    description: 'Active built-in + org custom roles',
  })
  async listOrgRoles(
    @Param('orgId') orgId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.listOrgRoles(session.user.id, orgId);
  }

  @Get('admin')
  @ApiOperation({ summary: 'List all org role configs for admin settings' })
  @ApiResponse({
    status: 200,
    description: 'Built-in roles with activation state + custom roles',
  })
  async listAllOrgRolesForAdmin(
    @Param('orgId') orgId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.listAllOrgRolesForAdmin(
      session.user.id,
      orgId,
    );
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createOrgTeamRoleSchema))
  @ApiOperation({ summary: 'Create an org-custom team role (org admin)' })
  @ApiResponse({ status: 201, description: 'Custom role created' })
  async createOrgCustomRole(
    @Param('orgId') orgId: string,
    @Body() body: CreateOrgTeamRoleDto,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.createOrgCustomRole(
      session.user.id,
      orgId,
      body,
    );
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateTeamRoleSchema))
  @ApiOperation({ summary: 'Update an org-custom team role (org admin)' })
  @ApiResponse({ status: 200, description: 'Custom role updated' })
  async updateOrgCustomRole(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateTeamRoleDto,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.updateOrgCustomRole(
      session.user.id,
      orgId,
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an org-custom team role (org admin)' })
  @ApiResponse({ status: 200, description: 'Custom role deleted' })
  @ApiResponse({ status: 409, description: 'Role is in use by team members' })
  async deleteOrgCustomRole(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.deleteOrgCustomRole(
      session.user.id,
      orgId,
      id,
    );
  }

  @Put(':id/activation')
  @UsePipes(new ZodValidationPipe(toggleRoleActivationSchema))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle a built-in role active/inactive for this org',
  })
  @ApiResponse({ status: 200, description: 'Activation state updated' })
  async toggleBuiltInRoleActivation(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: ToggleRoleActivationDto,
    @Session() session: SessionUser,
  ) {
    return this.teamRolesService.toggleBuiltInRoleForOrg(
      session.user.id,
      orgId,
      id,
      body,
    );
  }
}
