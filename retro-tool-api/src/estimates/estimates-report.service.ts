import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  inArray,
  count,
  desc,
  ilike,
  or,
  type SQL,
} from 'drizzle-orm';
import * as estimatesSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { EmailService } from '../email/email.service';
import { SendEstimateReportDto } from './dtos';
import {
  ESTIMATE_SESSION_STATUSES,
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
} from '../common/enums';

type Database = NodePgDatabase<
  typeof estimatesSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

/**
 * Completed-session history queries and email report generation for story
 * estimates. Split out of EstimatesService (which was ~1,500 lines) since these
 * read-only aggregation + email paths are a distinct concern from the live
 * session/round/vote mutations.
 */
@Injectable()
export class EstimatesReportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
  ) {}

  async getHistory(
    userId: string,
    page = 1,
    limit = 15,
    teamId?: string,
    search?: string,
  ): Promise<{
    sessions: {
      id: string;
      name: string;
      teamId: string;
      teamName: string | null;
      teamEmoji: string | null;
      orgId: string | null;
      orgName: string | null;
      currentStory: string | null;
      participantCount: number;
      roundCount: number;
      storiesEstimated: number;
      totalVotes: number;
      updatedAt: Date;
      createdAt: Date;
      canDelete: boolean;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const normalizedSearch = search?.trim();

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    // Build team scope
    let allUserTeamMemberships: { teamId: string; tag: string }[] = [];
    let allowedTeamIds: string[] | null = null;
    if (!isAdmin) {
      allUserTeamMemberships = await this.database
        .select({
          teamId: teamSchema.teamMember.teamId,
          tag: teamSchema.teamMember.tag,
        })
        .from(teamSchema.teamMember)
        .where(eq(teamSchema.teamMember.userId, userId));
      allowedTeamIds = allUserTeamMemberships.map((m) => m.teamId);
      if (allowedTeamIds.length === 0) {
        return { sessions: [], total: 0, page, limit };
      }
    }

    // Pre-fetch org admin/owner memberships for canDelete checks
    let adminOrgIds = new Set<string>();
    let leadTeamIds = new Set<string>();
    if (!isAdmin) {
      const orgMemberships = await this.database
        .select({
          organizationId: orgSchema.organizationMember.organizationId,
          role: orgSchema.organizationMember.role,
        })
        .from(orgSchema.organizationMember)
        .where(eq(orgSchema.organizationMember.userId, userId));

      adminOrgIds = new Set(
        orgMemberships
          .filter(
            (m) =>
              m.role === ORG_MEMBER_ROLES.Owner ||
              m.role === ORG_MEMBER_ROLES.Admin,
          )
          .map((m) => m.organizationId),
      );

      leadTeamIds = new Set(
        allUserTeamMemberships
          .filter((m) => m.tag === TEAM_MEMBER_TAGS.Lead)
          .map((m) => m.teamId),
      );
    }

    const conditions: SQL[] = [
      eq(
        estimatesSchema.storyEstimateSession.status,
        ESTIMATE_SESSION_STATUSES.Completed,
      ),
    ];
    if (teamId)
      conditions.push(eq(estimatesSchema.storyEstimateSession.teamId, teamId));
    if (allowedTeamIds) {
      conditions.push(
        inArray(estimatesSchema.storyEstimateSession.teamId, allowedTeamIds),
      );
    }
    if (normalizedSearch) {
      conditions.push(
        or(
          ilike(
            estimatesSchema.storyEstimateSession.name,
            `%${normalizedSearch}%`,
          ),
          ilike(
            estimatesSchema.storyEstimateSession.currentStory,
            `%${normalizedSearch}%`,
          ),
          ilike(teamSchema.team.name, `%${normalizedSearch}%`),
          ilike(orgSchema.organization.name, `%${normalizedSearch}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(estimatesSchema.storyEstimateSession)
      .leftJoin(
        teamSchema.team,
        eq(estimatesSchema.storyEstimateSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(whereClause);

    const rows = await this.database
      .select({
        id: estimatesSchema.storyEstimateSession.id,
        name: estimatesSchema.storyEstimateSession.name,
        teamId: estimatesSchema.storyEstimateSession.teamId,
        teamName: teamSchema.team.name,
        teamEmoji: teamSchema.team.emoji,
        orgId: teamSchema.team.organizationId,
        orgName: orgSchema.organization.name,
        currentStory: estimatesSchema.storyEstimateSession.currentStory,
        updatedAt: estimatesSchema.storyEstimateSession.updatedAt,
        createdAt: estimatesSchema.storyEstimateSession.createdAt,
      })
      .from(estimatesSchema.storyEstimateSession)
      .leftJoin(
        teamSchema.team,
        eq(estimatesSchema.storyEstimateSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(whereClause)
      .orderBy(desc(estimatesSchema.storyEstimateSession.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const sessions = await Promise.all(
      rows.map(async (row) => {
        const [pc] = await this.database
          .select({ total: count() })
          .from(estimatesSchema.storyEstimateParticipant)
          .where(
            eq(estimatesSchema.storyEstimateParticipant.sessionId, row.id),
          );

        const [rc] = await this.database
          .select({ total: count() })
          .from(estimatesSchema.storyEstimateRound)
          .where(eq(estimatesSchema.storyEstimateRound.sessionId, row.id));

        const [vc] = await this.database
          .select({ total: count() })
          .from(estimatesSchema.storyEstimateVote)
          .where(eq(estimatesSchema.storyEstimateVote.sessionId, row.id));

        const roundCount = rc?.total ?? 0;

        const canDelete =
          isAdmin ||
          (row.orgId !== null && adminOrgIds.has(row.orgId)) ||
          leadTeamIds.has(row.teamId);

        let storiesEstimated = 0;
        if (roundCount > 0) {
          storiesEstimated = roundCount;
        } else if (row.currentStory) {
          storiesEstimated = 1;
        }

        return {
          ...row,
          participantCount: pc?.total ?? 0,
          roundCount,
          storiesEstimated,
          totalVotes: vc?.total ?? 0,
          canDelete,
        };
      }),
    );

    return { sessions, total: totalRow?.total ?? 0, page, limit };
  }

  async sendEstimateReport(
    userId: string,
    sessionId: string,
    data: SendEstimateReportDto,
  ): Promise<{ sent: number }> {
    const [row] = await this.database
      .select({
        session: estimatesSchema.storyEstimateSession,
        team: {
          id: teamSchema.team.id,
          name: teamSchema.team.name,
        },
      })
      .from(estimatesSchema.storyEstimateSession)
      .leftJoin(
        teamSchema.team,
        eq(estimatesSchema.storyEstimateSession.teamId, teamSchema.team.id),
      )
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('Session not found');

    if (row.session.status !== ESTIMATE_SESSION_STATUSES.Completed) {
      throw new BadRequestException('Session must be completed to send report');
    }

    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, row.session.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership)
      throw new ForbiddenException('You are not a member of this team');

    // Fetch completed rounds with stats
    const rounds = await this.database
      .select({
        id: estimatesSchema.storyEstimateRound.id,
        roundNumber: estimatesSchema.storyEstimateRound.roundNumber,
        storyName: estimatesSchema.storyEstimateRound.storyName,
        ticketNumber: estimatesSchema.storyEstimateRound.ticketNumber,
        agreedPoints: estimatesSchema.storyEstimateRound.agreedPoints,
        votesCount: count(estimatesSchema.storyEstimateVote.id),
      })
      .from(estimatesSchema.storyEstimateRound)
      .leftJoin(
        estimatesSchema.storyEstimateVote,
        eq(
          estimatesSchema.storyEstimateVote.roundId,
          estimatesSchema.storyEstimateRound.id,
        ),
      )
      .where(eq(estimatesSchema.storyEstimateRound.sessionId, sessionId))
      .groupBy(estimatesSchema.storyEstimateRound.id)
      .orderBy(estimatesSchema.storyEstimateRound.roundNumber);

    // Compute numeric averages per round from votes
    const allVotes = await this.database
      .select({
        roundId: estimatesSchema.storyEstimateVote.roundId,
        points: estimatesSchema.storyEstimateVote.points,
      })
      .from(estimatesSchema.storyEstimateVote)
      .innerJoin(
        estimatesSchema.storyEstimateRound,
        eq(
          estimatesSchema.storyEstimateVote.roundId,
          estimatesSchema.storyEstimateRound.id,
        ),
      )
      .where(eq(estimatesSchema.storyEstimateRound.sessionId, sessionId));

    const avgByRound = new Map<string, number | null>();
    const votesByRound = new Map<string, string[]>();
    for (const v of allVotes) {
      if (!v.roundId) continue;
      const arr = votesByRound.get(v.roundId) ?? [];
      arr.push(v.points);
      votesByRound.set(v.roundId, arr);
    }
    for (const [roundId, pts] of votesByRound.entries()) {
      const nums = pts.map((p) => parseFloat(p)).filter((n) => !isNaN(n));
      avgByRound.set(
        roundId,
        nums.length > 0
          ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) /
              10
          : null,
      );
    }

    // Unique participants
    const participantRows = await this.database
      .select({ userId: estimatesSchema.storyEstimateParticipant.userId })
      .from(estimatesSchema.storyEstimateParticipant)
      .where(eq(estimatesSchema.storyEstimateParticipant.sessionId, sessionId));
    const uniqueParticipants = new Set(participantRows.map((p) => p.userId))
      .size;

    const totalVotes = rounds.reduce((sum, r) => sum + (r.votesCount ?? 0), 0);

    // Determine recipients
    let recipients: string[] = [];
    if (data.recipients && data.recipients.length > 0) {
      recipients = data.recipients;
    } else {
      const teamMembers = await this.database
        .select({ email: authSchema.user.email, name: authSchema.user.name })
        .from(teamSchema.teamMember)
        .innerJoin(
          authSchema.user,
          eq(authSchema.user.id, teamSchema.teamMember.userId),
        )
        .where(eq(teamSchema.teamMember.teamId, row.session.teamId));
      recipients = teamMembers.map((m) => m.email);
    }

    if (!this.emailService.isConfigured()) {
      return { sent: 0 };
    }

    const completedAt = row.session.updatedAt
      ? new Date(row.session.updatedAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'N/A';

    const roundSummaries = rounds.map((r) => ({
      roundNumber: r.roundNumber,
      storyName: r.storyName,
      ticketNumber: r.ticketNumber,
      agreedPoints: r.agreedPoints,
      average: avgByRound.get(r.id) ?? null,
      votesCount: Number(r.votesCount ?? 0),
    }));

    let sent = 0;
    for (const email of recipients) {
      const html = this.emailService.buildEstimateReportHtml({
        recipientName: 'Team Member',
        sessionName: row.session.name,
        teamName: row.team?.name ?? 'Team',
        completedAt,
        stats: {
          rounds: rounds.length,
          participants: uniqueParticipants,
          totalVotes,
        },
        rounds: roundSummaries,
      });

      const ok = await this.emailService.send({
        to: email,
        subject: `Story Estimate Report: ${row.session.name}`,
        html,
        userId,
        type: 'retro_report',
      });
      if (ok) sent++;
    }

    return { sent };
  }
}
