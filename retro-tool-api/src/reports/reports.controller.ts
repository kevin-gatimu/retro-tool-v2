import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ReportsService } from './reports.service';
import type { ReportPeriod, SessionUser } from '../common/types';

@ApiTags('reports')
@Controller('reports')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user personal participation stats' })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiQuery({
    name: 'teamId',
    required: false,
    description: 'Filter stats to a specific team',
  })
  @ApiResponse({ status: 200, description: 'UserStats' })
  getUserStats(
    @Session() session: SessionUser,
    @Query('period') period?: ReportPeriod,
    @Query('teamId') teamId?: string,
  ) {
    return this.reportsService.getUserStats(session.user.id, period, teamId);
  }

  @Get('teams/:teamId/metrics')
  @ApiOperation({ summary: 'Get team retro metrics for a given period' })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by team member',
  })
  @ApiResponse({ status: 200, description: 'TeamMetrics' })
  getTeamMetrics(
    @Session() session: SessionUser,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('period') period: ReportPeriod = 'month',
    @Query('userId') userId?: string,
  ) {
    return this.reportsService.getTeamMetrics(
      session.user.id,
      teamId,
      period,
      userId,
    );
  }

  @Get('teams/:teamId/health')
  @ApiOperation({ summary: 'Get team health score (0–100)' })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiResponse({ status: 200, description: 'HealthScore' })
  getHealthScore(
    @Session() session: SessionUser,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('period') period: ReportPeriod = 'month',
  ) {
    return this.reportsService.getHealthScore(session.user.id, teamId, period);
  }

  @Get('teams/:teamId/action-items')
  @ApiOperation({ summary: 'Get action item analytics for a team' })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiResponse({ status: 200, description: 'ActionItemAnalytics' })
  getActionItemAnalytics(
    @Session() session: SessionUser,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('period') period: ReportPeriod = 'month',
  ) {
    return this.reportsService.getActionItemAnalytics(
      session.user.id,
      teamId,
      period,
    );
  }

  @Get('teams/:teamId/estimate-kpis')
  @ApiOperation({ summary: 'Get story estimation KPIs for a team' })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiResponse({ status: 200, description: 'EstimateKPIs' })
  getEstimateKPIs(
    @Session() session: SessionUser,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('period') period: ReportPeriod = 'month',
  ) {
    return this.reportsService.getEstimateKPIs(session.user.id, teamId, period);
  }

  @Get('organizations/:orgId/templates')
  @ApiOperation({ summary: 'Get template usage metrics for an organization' })
  @ApiResponse({ status: 200, description: 'TemplateUsageMetrics[]' })
  getTemplateUsageMetrics(
    @Session() session: SessionUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.reportsService.getTemplateUsageMetrics(session.user.id, orgId);
  }

  @Get('organizations/:orgId/overview')
  @ApiOperation({
    summary: 'Get org-level aggregated analytics (org admin/owner only)',
  })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter', 'year'],
    required: false,
  })
  @ApiQuery({
    name: 'tbSearch',
    required: false,
    description: 'Filter team breakdown by team name',
  })
  @ApiResponse({ status: 200, description: 'OrgOverview' })
  getOrgOverview(
    @Session() session: SessionUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('period') period: ReportPeriod = 'month',
    @Query('tbPage', new ParseIntPipe({ optional: true })) tbPage?: number,
    @Query('tbLimit', new ParseIntPipe({ optional: true })) tbLimit?: number,
    @Query('tbSearch') tbSearch?: string,
  ) {
    return this.reportsService.getOrgOverview(
      session.user.id,
      orgId,
      period,
      tbPage ?? 1,
      tbLimit ?? 8,
      tbSearch,
    );
  }

  @Get('system')
  @ApiOperation({
    summary: 'Get system-wide analytics (super admin / system admin only)',
  })
  @ApiQuery({
    name: 'obSearch',
    required: false,
    description: 'Filter organization breakdown by organization name',
  })
  @ApiResponse({ status: 200, description: 'SystemOverview' })
  getSystemOverview(
    @Session() session: SessionUser,
    @Query('obPage', new ParseIntPipe({ optional: true })) obPage?: number,
    @Query('obLimit', new ParseIntPipe({ optional: true })) obLimit?: number,
    @Query('obSearch') obSearch?: string,
  ) {
    return this.reportsService.getSystemOverview(
      session.user.id,
      obPage ?? 1,
      obLimit ?? 8,
      obSearch,
    );
  }
}
