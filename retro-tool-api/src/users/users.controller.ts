import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import {
  AllowAnonymous,
  AuthGuard,
  Roles,
  Session,
} from '@thallesp/nestjs-better-auth';
import { UsersService } from './users.service';
import {
  updateStatusSchema,
  UpdateStatusDto,
  updateRoleSchema,
  UpdateRoleDto,
  updateProfileSchema,
  UpdateProfileDto,
  suspendUserSchema,
  SuspendUserDto,
  bulkUpdateStatusSchema,
  BulkUpdateStatusDto,
} from './dtos';
import { TUserStatusFilter, TUserRoleFilter } from '../common/enums';
import { CommonService } from '../common/common.service';
import type { SessionUser } from '../common/types';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly commonService: CommonService,
  ) {}

  // ============================================================================
  // Public / Authenticated User Endpoints
  // ============================================================================

  /**
   * Get current authenticated user
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns the current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Session() session: SessionUser) {
    return this.usersService.getMe(session.user.id);
  }

  /**
   * Update current user's profile
   */
  @Patch('me')
  @ApiOperation({ summary: "Update current user's profile" })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateProfile(
    @Body() body: UpdateProfileDto,
    @Session() session: SessionUser,
  ) {
    return this.usersService.updateProfile(session.user.id, body);
  }

  /**
   * Search approved users (for adding to teams/orgs)
   * Accessible to any authenticated user
   */
  @Get('search')
  @ApiOperation({ summary: 'Search approved users' })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search query',
  })
  @ApiResponse({ status: 200, description: 'Returns list of approved users' })
  async searchApprovedUsers(@Query('q') search?: string) {
    return this.usersService.searchApproved(search);
  }

  // ============================================================================
  // Admin-only Endpoints
  // ============================================================================

  /**
   * Get all users with optional search/filter
   * System admins can see all users
   */
  @Get()
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'pending', 'approved', 'rejected', 'suspended'],
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: [
      'all',
      'super-admin',
      'system-admin',
      'org-admin',
      'team-lead',
      'member',
    ],
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'email', 'status', 'role', 'createdAt', 'lastActiveAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns paginated list of users' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findAll(
    @Session() session: SessionUser,
    @Query('search') search?: string,
    @Query('status') status?: TUserStatusFilter,
    @Query('role') role?: TUserRoleFilter,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.usersService.findAll(session.user.id, {
      search,
      status,
      role,
      sortBy,
      sortOrder,
      page,
      limit,
    });
  }

  /**
   * Get a single user by ID
   */
  @Get(':id')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user details' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.findOne(session.user.id, id);
  }

  /**
   * Update user status (approve/reject)
   */
  @Patch(':id/status')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Update user status (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UsePipes(new ZodValidationPipe(updateStatusSchema))
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusDto,
    @Session() session: SessionUser,
  ) {
    return this.usersService.updateStatus(session.user.id, id, body);
  }

  /**
   * Update user role (admin/member)
   */
  @Patch(':id/role')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UsePipes(new ZodValidationPipe(updateRoleSchema))
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
    @Session() session: SessionUser,
  ) {
    return this.usersService.updateRole(session.user.id, id, body);
  }

  /**
   * Promote a user to system-admin (super-admin only)
   */
  @Post(':id/promote-system-admin')
  @Roles(['super-admin'])
  @ApiOperation({ summary: 'Promote user to system-admin (super-admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User promoted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async promoteSystemAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.promoteToSystemAdmin(session.user.id, id);
  }

  /**
   * Demote a system-admin to member (super-admin only)
   */
  @Post(':id/demote-system-admin')
  @Roles(['super-admin'])
  @ApiOperation({ summary: 'Demote system-admin to member (super-admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User demoted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async demoteSystemAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.demoteSystemAdminToMember(session.user.id, id);
  }

  /**
   * Delete a user (self or admin)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user (self or admin)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only delete self or as admin',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.deleteUser(session.user.id, id);
  }

  /**
   * Suspend a user
   */
  @Post(':id/suspend')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Suspend a user (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UsePipes(new ZodValidationPipe(suspendUserSchema))
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SuspendUserDto,
    @Session() session: SessionUser,
  ) {
    return this.usersService.suspendUser(session.user.id, id, body);
  }

  /**
   * Reactivate a suspended user
   */
  @Post(':id/reactivate')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Reactivate a suspended user (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User reactivated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async reactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.reactivateUser(session.user.id, id);
  }

  /**
   * Bulk update user status
   */
  @Post('bulk/status')
  @Roles(['super-admin', 'system-admin'])
  @ApiOperation({ summary: 'Bulk update user statuses (admin only)' })
  @ApiResponse({ status: 200, description: 'Users updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @UsePipes(new ZodValidationPipe(bulkUpdateStatusSchema))
  async bulkUpdateStatus(
    @Body() body: BulkUpdateStatusDto,
    @Session() session: SessionUser,
  ) {
    return this.usersService.bulkUpdateStatus(session.user.id, body);
  }

  /**
   * Get user details with org/team memberships & action history
   */
  @Get(':id/details')
  @Roles(['super-admin', 'system-admin'])
  async getUserDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: SessionUser,
  ) {
    return this.usersService.getUserDetails(session.user.id, id);
  }

  /**
   * Get admin action log
   */
  @Get('admin/logs')
  @Roles(['super-admin', 'system-admin'])
  async getAdminActionLog(
    @Session() session: SessionUser,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('dateRange')
    dateRange?: 'today' | 'week' | 'month' | 'year',
    @Query('adminRole') adminRole?: string,
  ) {
    return this.usersService.getAdminActionLog(session.user.id, {
      page,
      limit,
      userId,
      dateRange,
      adminRole,
    });
  }

  /**
   * Check if any admin exists (for bootstrapping)
   * This route is public so the frontend can bootstrap without an existing session.
   */
  @Get('admin/exists')
  @AllowAnonymous()
  async checkAdminExists() {
    return this.commonService.checkAdminExists();
  }

  /**
   * Bootstrap first admin
   * Public as well; the client signs up and then immediately calls this endpoint
   * once they have a session cookie (signup auto-auths). If they somehow hit it
   * without a session, the service will still handle it gracefully.
   */
  @Post('admin/bootstrap')
  @AllowAnonymous()
  async bootstrapFirstAdmin(@Session() session: SessionUser) {
    return this.usersService.bootstrapFirstAdmin(session?.user?.id);
  }
}
