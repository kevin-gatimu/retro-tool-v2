import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { TeamsService } from './teams.service';
import type { SessionUser } from '../common/types';
import {
  createTeamSchema,
  CreateTeamDto,
  updateTeamSchema,
  UpdateTeamDto,
  addTeamMemberSchema,
  AddTeamMemberDto,
  updateTeamMemberSchema,
  UpdateTeamMemberDto,
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

@ApiTags('teams')
@Controller('teams')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // Permission enforced in service (system admins + org admins allowed)
  @Post()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization admin access required',
  })
  @UsePipes(new ZodValidationPipe(createTeamSchema))
  async createTeam(
    @Body() body: CreateTeamDto,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.createTeam(session.user.id, body);
  }

  // Any authenticated user can list teams; service filters by membership
  @Get()
  @ApiOperation({ summary: 'Get teams' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    type: String,
    description: 'Filter by organization ID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter teams by name',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of teams' })
  async getTeams(
    @Session() session: SessionUser,
    @Query('organizationId')
    organizationId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('search') search?: string,
  ) {
    if (organizationId) {
      return this.teamsService.getOrganizationTeams(
        session.user.id,
        organizationId,
        page,
        limit,
        search,
      );
    }

    return this.teamsService.getUserTeams(session.user.id, page, limit, search);
  }

  // Team membership validated in service
  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Returns team details' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.getTeamById(session.user.id, id);
  }

  // Org admin + team lead logic handled in service
  @Put(':id')
  @ApiOperation({ summary: 'Update team' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @UsePipes(new ZodValidationPipe(updateTeamSchema))
  async updateTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamDto,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.updateTeam(session.user.id, id, body);
  }

  // Permission enforced in service (system admins + org admins allowed)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete team' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async deleteTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.deleteTeam(session.user.id, id);
  }

  // Team membership validated in service
  @Get(':id/members')
  @ApiOperation({ summary: 'Get team members' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of team members',
  })
  async getTeamMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.getTeamMembers(session.user.id, id, page, limit);
  }

  // Org admin + team lead logic handled in service
  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to team' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  @UsePipes(new ZodValidationPipe(addTeamMemberSchema))
  async addTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddTeamMemberDto,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.addTeamMember(session.user.id, id, body);
  }

  // Org admin + team lead logic handled in service
  @Delete(':teamId/members/:memberId')
  @ApiOperation({ summary: 'Remove member from team' })
  @ApiParam({
    name: 'teamId',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'memberId',
    type: String,
    format: 'uuid',
    description: 'Member ID',
  })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  async removeTeamMember(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.removeTeamMember(
      session.user.id,
      teamId,
      memberId,
    );
  }

  // Org admin + team lead logic handled in service
  @Patch(':teamId/members/:memberId')
  @ApiOperation({ summary: 'Update team member role/tag' })
  @ApiParam({
    name: 'teamId',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'memberId',
    type: String,
    format: 'uuid',
    description: 'Member ID',
  })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  @UsePipes(new ZodValidationPipe(updateTeamMemberSchema))
  async updateTeamMember(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: UpdateTeamMemberDto,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.updateTeamMemberRole(
      session.user.id,
      teamId,
      memberId,
      body,
    );
  }

  @Patch(':teamId/members/:memberId/job-role')
  @ApiOperation({ summary: 'Update member job role (dev/qa/etc)' })
  @ApiParam({
    name: 'teamId',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'memberId',
    type: String,
    format: 'uuid',
    description: 'Member ID',
  })
  @ApiResponse({ status: 200, description: 'Job role updated' })
  async updateMemberJobRole(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body('role') jobRole: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.updateTeamMemberJobRole(
      session.user.id,
      teamId,
      memberId,
      jobRole,
    );
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a team (self)' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Joined team successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not an org member or already on team',
  })
  async joinTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.joinTeam(session.user.id, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a team (self)' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Left team successfully' })
  async leaveTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.leaveTeam(session.user.id, id);
  }

  // ===========================================================================
  // Join Requests
  // ===========================================================================

  @Post(':id/join-requests')
  @ApiOperation({ summary: 'Submit a join request for a team' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 201, description: 'Join request created' })
  async createJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('message') message: string | undefined,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.createJoinRequest(session.user.id, id, message);
  }

  @Get(':id/join-requests')
  @ApiOperation({ summary: 'List join requests for a team (managers only)' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'List of join requests' })
  async getJoinRequests(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.getJoinRequests(session.user.id, id);
  }

  @Get(':id/join-requests/:requestId')
  @ApiOperation({ summary: 'Get a single join request' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'requestId',
    type: String,
    format: 'uuid',
    description: 'Request ID',
  })
  @ApiResponse({ status: 200, description: 'Join request details' })
  async getJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.getJoinRequest(session.user.id, id, requestId);
  }

  @Delete(':id/join-requests/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a join request' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'requestId',
    type: String,
    format: 'uuid',
    description: 'Request ID',
  })
  @ApiResponse({ status: 200, description: 'Join request cancelled' })
  async cancelJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.cancelJoinRequest(session.user.id, id, requestId);
  }

  @Post(':id/join-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a join request' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'requestId',
    type: String,
    format: 'uuid',
    description: 'Request ID',
  })
  @ApiResponse({ status: 200, description: 'Join request approved' })
  async approveJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.approveJoinRequest(session.user.id, id, requestId);
  }

  @Post(':id/join-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a join request' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiParam({
    name: 'requestId',
    type: String,
    format: 'uuid',
    description: 'Request ID',
  })
  @ApiResponse({ status: 200, description: 'Join request rejected' })
  async rejectJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body('reviewNote') reviewNote: string | undefined,
    @Session() session: SessionUser,
  ) {
    return this.teamsService.rejectJoinRequest(
      session.user.id,
      id,
      requestId,
      reviewNote,
    );
  }

  @Post(':id/join-requests/bulk-approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk approve join requests' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Team ID',
  })
  @ApiResponse({ status: 200, description: 'Requests approved' })
  async bulkApproveJoinRequests(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('requestIds') requestIds: string[],
    @Session() session: SessionUser,
  ) {
    return this.teamsService.bulkApproveJoinRequests(
      session.user.id,
      id,
      requestIds,
    );
  }

  @Get('join-requests/all')
  @ApiOperation({ summary: 'Get all pending join requests (system admin)' })
  @ApiResponse({ status: 200, description: 'All pending join requests' })
  async getAllPendingJoinRequests(@Session() session: SessionUser) {
    return this.teamsService.getAllPendingJoinRequests(session.user.id);
  }
}
