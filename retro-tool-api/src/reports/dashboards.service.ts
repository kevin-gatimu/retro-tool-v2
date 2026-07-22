import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as retroSchema from '../retros/schema';
import * as teamSchema from '../teams/schema';
import * as orgSchema from '../organizations/schema';
import * as authSchema from '../auth/schema';
import * as estimateSchema from '../estimates/schema';
import * as standupSchema from '../standups/schema';
import * as surveySchema from '../surveys/schema';
import * as pollSchema from '../polls/schema';
import * as icebreakerSchema from '../icebreakers/schema';
import type {
  OrgLeagueRow,
  OrgReport,
  OrgTeamLeagueRow,
  Paginated,
  PersonalReport,
  PlatformReport,
  TeamMemberBreakdownRow,
  TeamReport,
} from './types';
import { resolveRange } from './dto';
import type { LeagueQueryDto, ReportRangeDto } from './dto';
import { buildPersonalReport } from './queries/personal-report.queries';
import { buildTeamReport } from './queries/team-report.queries';
import { buildOrgReport } from './queries/org-report.queries';
import { buildPlatformReport } from './queries/platform-report.queries';
import {
  buildOrgTeamsLeague,
  buildPlatformOrgsLeague,
  buildTeamMembersLeague,
} from './queries/league.queries';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof orgSchema &
    typeof authSchema &
    typeof estimateSchema &
    typeof standupSchema &
    typeof surveySchema &
    typeof pollSchema &
    typeof icebreakerSchema
>;

/**
 * Reports v2 orchestration (REPORTS-REDESIGN-PLAN §6): thin service that
 * resolves the requested range and delegates all aggregation to the pure
 * SQL builders in `queries/`. Authorization lives in `guards/`.
 */
@Injectable()
export class DashboardsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  getPersonalReport(
    userId: string,
    query: ReportRangeDto,
  ): Promise<PersonalReport> {
    return buildPersonalReport(this.database, userId, resolveRange(query));
  }

  getTeamReport(
    teamId: string,
    query: ReportRangeDto,
    isLead: boolean,
  ): Promise<TeamReport> {
    return buildTeamReport(this.database, teamId, resolveRange(query), isLead);
  }

  getOrgReport(orgId: string, query: ReportRangeDto): Promise<OrgReport> {
    return buildOrgReport(this.database, orgId, resolveRange(query));
  }

  getPlatformReport(query: ReportRangeDto): Promise<PlatformReport> {
    return buildPlatformReport(this.database, resolveRange(query));
  }

  getTeamMembersLeague(
    teamId: string,
    query: LeagueQueryDto,
  ): Promise<Paginated<TeamMemberBreakdownRow>> {
    return buildTeamMembersLeague(
      this.database,
      teamId,
      resolveRange(query),
      query,
    );
  }

  getOrgTeamsLeague(
    orgId: string,
    query: LeagueQueryDto,
  ): Promise<Paginated<OrgTeamLeagueRow>> {
    return buildOrgTeamsLeague(
      this.database,
      orgId,
      resolveRange(query),
      query,
    );
  }

  getPlatformOrgsLeague(
    query: LeagueQueryDto,
  ): Promise<Paginated<OrgLeagueRow>> {
    return buildPlatformOrgsLeague(this.database, resolveRange(query), query);
  }
}
