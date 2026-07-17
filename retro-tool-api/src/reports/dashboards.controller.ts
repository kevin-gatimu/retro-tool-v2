import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import type { SessionUser } from '../common/types';
import { ZodParamPipe } from '../common/pipes/zod-param.pipe';
import { DashboardsService } from './dashboards.service';
import { leagueQuerySchema, reportRangeSchema } from './dto';
import type { LeagueQueryDto, ReportRangeDto } from './dto';
import { TeamReportAccessGuard } from './guards/team-report-access.guard';
import { OrgReportAccessGuard } from './guards/org-report-access.guard';
import { SystemReportAccessGuard } from './guards/system-report-access.guard';
import type { ReportsRequestSession } from './types';

/**
 * Reports v2 — one composite, chart-ready payload per role dashboard.
 * The legacy `/reports/*` endpoints remain until the UI cutover completes.
 */
@ApiTags('reports-v2')
@Controller('reports/v2')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('me')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'My Insights — personal contribution dashboard' })
  @ApiResponse({ status: 200, description: 'PersonalReport payload' })
  async getMyReport(
    @Query(new ZodParamPipe(reportRangeSchema)) query: ReportRangeDto,
    @Session() session: SessionUser,
  ) {
    return this.dashboardsService.getPersonalReport(session.user.id, query);
  }

  @Get('teams/:teamId')
  @UseGuards(TeamReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({
    summary:
      'Team health dashboard (members: aggregate; team-lead+: adds per-member breakdown)',
  })
  @ApiParam({ name: 'teamId', type: String })
  @ApiResponse({ status: 200, description: 'TeamReport payload' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  async getTeamReport(
    @Param('teamId') teamId: string,
    @Query(new ZodParamPipe(reportRangeSchema)) query: ReportRangeDto,
    @Req() request: ReportsRequestSession,
  ) {
    const isLead = request.reportAccess?.isLead ?? false;
    return this.dashboardsService.getTeamReport(teamId, query, isLead);
  }

  @Get('teams/:teamId/members')
  @UseGuards(TeamReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({
    summary: 'Paginated per-member breakdown (team-lead and above only)',
  })
  @ApiParam({ name: 'teamId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated<TeamMemberBreakdownRow>',
  })
  @ApiResponse({ status: 403, description: 'Team-lead access required' })
  async getTeamMembersLeague(
    @Param('teamId') teamId: string,
    @Query(new ZodParamPipe(leagueQuerySchema)) query: LeagueQueryDto,
    @Req() request: ReportsRequestSession,
  ) {
    if (!request.reportAccess?.isLead) {
      throw new ForbiddenException('Team-lead access required');
    }
    return this.dashboardsService.getTeamMembersLeague(teamId, query);
  }

  @Get('organizations/:orgId')
  @UseGuards(OrgReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Organization dashboard (org admin+)' })
  @ApiParam({ name: 'orgId', type: String })
  @ApiResponse({ status: 200, description: 'OrgReport payload' })
  @ApiResponse({ status: 403, description: 'Org admin access required' })
  async getOrgReport(
    @Param('orgId') orgId: string,
    @Query(new ZodParamPipe(reportRangeSchema)) query: ReportRangeDto,
  ) {
    return this.dashboardsService.getOrgReport(orgId, query);
  }

  @Get('organizations/:orgId/teams')
  @UseGuards(OrgReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Paginated team league for an organization' })
  @ApiParam({ name: 'orgId', type: String })
  @ApiResponse({ status: 200, description: 'Paginated<OrgTeamLeagueRow>' })
  async getOrgTeamsLeague(
    @Param('orgId') orgId: string,
    @Query(new ZodParamPipe(leagueQuerySchema)) query: LeagueQueryDto,
  ) {
    return this.dashboardsService.getOrgTeamsLeague(orgId, query);
  }

  @Get('platform')
  @UseGuards(SystemReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Platform dashboard (system admin+)' })
  @ApiResponse({ status: 200, description: 'PlatformReport payload' })
  @ApiResponse({ status: 403, description: 'System admin access required' })
  async getPlatformReport(
    @Query(new ZodParamPipe(reportRangeSchema)) query: ReportRangeDto,
  ) {
    return this.dashboardsService.getPlatformReport(query);
  }

  @Get('platform/organizations')
  @UseGuards(SystemReportAccessGuard)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Paginated organization league (system admin+)' })
  @ApiResponse({ status: 200, description: 'Paginated<OrgLeagueRow>' })
  async getPlatformOrgsLeague(
    @Query(new ZodParamPipe(leagueQuerySchema)) query: LeagueQueryDto,
  ) {
    return this.dashboardsService.getPlatformOrgsLeague(query);
  }
}
