import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, count, inArray, countDistinct } from 'drizzle-orm';
import * as retroSchema from '../retros/schema';
import * as teamSchema from '../teams/schema';
import * as orgSchema from '../organizations/schema';
import * as authSchema from '../auth/schema';
import * as estimateSchema from '../estimates/schema';
import {
  TeamMetrics,
  HealthScore,
  ActionItemAnalytics,
  TemplateUsageMetrics,
  UserStats,
  EstimateKPIs,
  OrgOverview,
  SystemOverview,
} from './schema';
import type { ReportPeriod as Period } from '../common/types';
import {
  ACTION_ITEM_STATUSES,
  ORG_MEMBER_ROLES,
  RETRO_STATUSES,
  USER_ROLES,
  USER_STATUSES,
  ESTIMATE_ROUND_STATUSES,
  ESTIMATE_SESSION_STATUSES,
} from '../common/enums';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof orgSchema &
    typeof authSchema &
    typeof estimateSchema
>;

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === 'week') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === 'quarter') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else {
    return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

function scoreDescription(score: number): string {
  if (score >= 80) return 'Excellent team health';
  if (score >= 60) return 'Good health, room to improve';
  if (score >= 40) return 'Needs improvement';
  return 'Critical — action required';
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  private async assertTeamMember(
    userId: string,
    teamId: string,
  ): Promise<void> {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Access denied');
  }

  private async assertOrgMember(userId: string, orgId: string): Promise<void> {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.teamMember.teamId, teamSchema.team.id),
      )
      .where(
        and(
          eq(teamSchema.team.organizationId, orgId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Access denied');
  }

  private async assertOrgAdmin(userId: string, orgId: string): Promise<void> {
    const [user] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (
      user?.role === USER_ROLES.SuperAdmin ||
      user?.role === USER_ROLES.SystemAdmin
    ) {
      return;
    }

    const [membership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.role !== ORG_MEMBER_ROLES.Owner &&
        membership.role !== ORG_MEMBER_ROLES.Admin)
    ) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertSystemAdmin(userId: string): Promise<void> {
    const [user] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (
      user?.role !== USER_ROLES.SuperAdmin &&
      user?.role !== USER_ROLES.SystemAdmin
    ) {
      throw new ForbiddenException('Access denied');
    }
  }

  async getTeamMetrics(
    userId: string,
    teamId: string,
    period: Period,
    filterUserId?: string,
  ): Promise<TeamMetrics> {
    await this.assertTeamMember(userId, teamId);

    const since = periodStart(period);

    const retros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, teamId),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, since),
        ),
      );

    const retroIds = retros.map((r) => r.id);
    const retroCount = retroIds.length;

    const [teamSizeRow] = await this.database
      .select({ total: count(teamSchema.teamMember.id) })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));
    const teamSize = Math.max(1, Number(teamSizeRow?.total ?? 1));

    if (retroCount === 0) {
      const emptyResult = {
        retroCount: 0,
        avgParticipants: 0,
        participationRate: 0,
        totalCards: 0,
        totalVotes: 0,
        avgCardsPerRetro: 0,
        actionItemsCompleted: 0,
        actionItemsPending: 0,
      };

      return emptyResult;
    }

    // Build card filter — optionally scope to a specific user
    const cardFilter =
      filterUserId && retroIds.length > 0
        ? and(
            inArray(retroSchema.card.retroId, retroIds),
            eq(retroSchema.card.authorId, filterUserId),
          )
        : retroIds.length > 0
          ? inArray(retroSchema.card.retroId, retroIds)
          : undefined;

    // Unique card authors (measures actual contribution)
    const authorRows = cardFilter
      ? await this.database
          .selectDistinct({ authorId: retroSchema.card.authorId })
          .from(retroSchema.card)
          .where(cardFilter)
      : [];
    const uniqueContributors = filterUserId
      ? authorRows.length > 0
        ? 1
        : 0
      : authorRows.length;

    const cardRows = cardFilter
      ? await this.database
          .select({ id: retroSchema.card.id })
          .from(retroSchema.card)
          .where(cardFilter)
      : [];
    const totalCards = cardRows.length;
    const cardIds = cardRows.map((c) => c.id);

    let totalVotes = 0;
    if (cardIds.length > 0) {
      const voteFilter = filterUserId
        ? and(
            inArray(retroSchema.vote.cardId, cardIds),
            eq(retroSchema.vote.userId, filterUserId),
          )
        : inArray(retroSchema.vote.cardId, cardIds);

      const voteRows = await this.database
        .select({ id: retroSchema.vote.id })
        .from(retroSchema.vote)
        .where(voteFilter);
      totalVotes = voteRows.length;
    }

    // Action items — scope to user if filter provided
    const aiFilter =
      filterUserId && retroIds.length > 0
        ? and(
            inArray(retroSchema.actionItem.retroId, retroIds),
            eq(retroSchema.actionItem.assigneeId, filterUserId),
          )
        : retroIds.length > 0
          ? inArray(retroSchema.actionItem.retroId, retroIds)
          : undefined;

    const aiRows = aiFilter
      ? await this.database
          .select({ status: retroSchema.actionItem.status })
          .from(retroSchema.actionItem)
          .where(aiFilter)
      : [];

    const actionItemsCompleted = aiRows.filter(
      (r) => r.status === ACTION_ITEM_STATUSES.Completed,
    ).length;
    const actionItemsPending = aiRows.filter(
      (r) => r.status !== ACTION_ITEM_STATUSES.Completed,
    ).length;

    const result = {
      retroCount,
      avgParticipants: Math.round((uniqueContributors / retroCount) * 10) / 10,
      participationRate: Math.round((uniqueContributors / teamSize) * 100),
      totalCards,
      totalVotes,
      avgCardsPerRetro: Math.round((totalCards / retroCount) * 10) / 10,
      actionItemsCompleted,
      actionItemsPending,
    };

    return result;
  }

  async getHealthScore(
    userId: string,
    teamId: string,
    period: Period = 'month',
  ): Promise<HealthScore> {
    await this.assertTeamMember(userId, teamId);

    const since = periodStart(period);

    const retros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, teamId),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, since),
        ),
      );

    const retroIds = retros.map((r) => r.id);
    const retroCount = retroIds.length;

    const [teamSizeRow] = await this.database
      .select({ total: count(teamSchema.teamMember.id) })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));
    const teamSize = Math.max(1, Number(teamSizeRow?.total ?? 1));

    // ── Participation (0–30): unique card contributors vs team size ────────────
    let uniqueContributors = 0;
    let totalCards = 0;
    let totalVotes = 0;

    if (retroIds.length > 0) {
      const authorRows = await this.database
        .selectDistinct({ authorId: retroSchema.card.authorId })
        .from(retroSchema.card)
        .where(inArray(retroSchema.card.retroId, retroIds));
      uniqueContributors = authorRows.length;

      const cardRows = await this.database
        .select({ id: retroSchema.card.id })
        .from(retroSchema.card)
        .where(inArray(retroSchema.card.retroId, retroIds));
      totalCards = cardRows.length;
      const cardIds = cardRows.map((c) => c.id);

      if (cardIds.length > 0) {
        const voteRows = await this.database
          .select({ id: retroSchema.vote.id })
          .from(retroSchema.vote)
          .where(inArray(retroSchema.vote.cardId, cardIds));
        totalVotes = voteRows.length;
      }
    }

    const participationRate = teamSize > 0 ? uniqueContributors / teamSize : 0;
    const participationPoints = Math.min(
      30,
      Math.round(participationRate * 30),
    );

    // ── Engagement (0–25): cards per retro (60%) + votes per card (40%) ───────
    const cardsPerRetro = retroCount > 0 ? totalCards / retroCount : 0;
    const votesPerCard = totalCards > 0 ? totalVotes / totalCards : 0;
    const engagementPoints = Math.min(
      25,
      Math.round(
        (cardsPerRetro / 8) * 0.6 * 25 + (votesPerCard / 3) * 0.4 * 25,
      ),
    );

    // ── Completion (0–25): actual action item completion rate ──────────────────
    let completionPoints: number | null = null; // null when no action items exist
    if (retroIds.length > 0) {
      const aiRows = await this.database
        .select({ status: retroSchema.actionItem.status })
        .from(retroSchema.actionItem)
        .where(inArray(retroSchema.actionItem.retroId, retroIds));

      if (aiRows.length > 0) {
        const completedCount = aiRows.filter(
          (r) => r.status === ACTION_ITEM_STATUSES.Completed,
        ).length;
        completionPoints = Math.min(
          25,
          Math.round((completedCount / aiRows.length) * 25),
        );
      }
    }

    // ── Frequency (0–20): retros per month, target ≥ 2 ───────────────────────
    const frequencyPoints = Math.min(20, Math.round((retroCount / 2) * 20));

    // Score: scale over available dimensions.
    // When completionPoints is null (no action items), max is 75 instead of 100.
    const rawTotal =
      participationPoints +
      engagementPoints +
      (completionPoints ?? 0) +
      frequencyPoints;
    const maxTotal = completionPoints !== null ? 100 : 75;
    const score = Math.min(100, Math.round((rawTotal / maxTotal) * 100));

    // ── Trend: compare this month's retro count to quarter monthly average ─────
    const quarterSince = periodStart('quarter');
    const quarterRetros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, teamId),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, quarterSince),
        ),
      );
    const prevAvgRetros = quarterRetros.length / 3;
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (retroCount > prevAvgRetros * 1.2) trend = 'increasing';
    else if (retroCount < prevAvgRetros * 0.8) trend = 'decreasing';

    const result = {
      score,
      participationPoints,
      engagementPoints,
      completionPoints,
      frequencyPoints,
      description: scoreDescription(score),
      trend,
    };

    return result;
  }

  async getActionItemAnalytics(
    userId: string,
    teamId: string,
    period: Period = 'month',
  ): Promise<ActionItemAnalytics> {
    await this.assertTeamMember(userId, teamId);

    const since = periodStart(period);

    const allRetros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, teamId),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, since),
        ),
      );

    if (allRetros.length === 0) {
      const emptyResult = {
        totalAssigned: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        completionRate: 0,
        topAssignees: [],
      };

      return emptyResult;
    }

    const retroIds = allRetros.map((r) => r.id);
    const now = new Date();

    const aiRows = await this.database
      .select({
        status: retroSchema.actionItem.status,
        assigneeId: retroSchema.actionItem.assigneeId,
        dueDate: retroSchema.actionItem.dueDate,
      })
      .from(retroSchema.actionItem)
      .where(inArray(retroSchema.actionItem.retroId, retroIds));

    const total = aiRows.length;
    const completed = aiRows.filter(
      (r) => r.status === ACTION_ITEM_STATUSES.Completed,
    ).length;
    const overdue = aiRows.filter(
      (r) =>
        r.status !== ACTION_ITEM_STATUSES.Completed &&
        r.dueDate &&
        r.dueDate < now,
    ).length;
    const pending = total - completed;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Aggregate by assignee
    const assigneeCounts = new Map<
      string,
      { assigned: number; completed: number }
    >();
    for (const row of aiRows) {
      if (!row.assigneeId) continue;
      const entry = assigneeCounts.get(row.assigneeId) ?? {
        assigned: 0,
        completed: 0,
      };
      entry.assigned += 1;
      if (row.status === ACTION_ITEM_STATUSES.Completed) entry.completed += 1;
      assigneeCounts.set(row.assigneeId, entry);
    }

    const assigneeIds = [...assigneeCounts.keys()];
    let topAssignees: ActionItemAnalytics['topAssignees'] = [];

    if (assigneeIds.length > 0) {
      const users = await this.database
        .select({ id: authSchema.user.id, name: authSchema.user.name })
        .from(authSchema.user)
        .where(inArray(authSchema.user.id, assigneeIds));

      topAssignees = users
        .map((u) => {
          const counts = assigneeCounts.get(u.id)!;
          return {
            userId: u.id,
            userName: u.name,
            assignedCount: counts.assigned,
            completedCount: counts.completed,
          };
        })
        .sort((a, b) => b.assignedCount - a.assignedCount)
        .slice(0, 5);
    }

    const result = {
      totalAssigned: total,
      completed,
      pending,
      overdue,
      completionRate,
      topAssignees,
    };

    return result;
  }

  async getTemplateUsageMetrics(
    userId: string,
    orgId: string,
  ): Promise<TemplateUsageMetrics[]> {
    await this.assertOrgMember(userId, orgId);

    const templates = await this.database
      .select({ id: retroSchema.template.id, name: retroSchema.template.name })
      .from(retroSchema.template)
      .where(eq(retroSchema.template.organizationId, orgId));

    const result = await Promise.all(
      templates.map(async (tmpl) => {
        const retros = await this.database
          .select({ id: retroSchema.retrospective.id })
          .from(retroSchema.retrospective)
          .where(eq(retroSchema.retrospective.templateId, tmpl.id));

        const usageCount = retros.length;
        let avgCardsPerSession = 0;

        if (usageCount > 0) {
          const cardCounts = await Promise.all(
            retros.map((r) =>
              this.database
                .select({ id: retroSchema.card.id })
                .from(retroSchema.card)
                .where(eq(retroSchema.card.retroId, r.id)),
            ),
          );
          const totalCards = cardCounts.flat().length;
          avgCardsPerSession = Math.round((totalCards / usageCount) * 10) / 10;
        }

        return {
          templateId: tmpl.id,
          templateName: tmpl.name,
          usageCount,
          avgCardsPerSession,
        };
      }),
    );

    return result;
  }

  async getUserStats(
    userId: string,
    period?: Period,
    teamId?: string,
  ): Promise<UserStats> {
    const since = period ? periodStart(period) : undefined;

    // Teams count
    const teamFilter = teamId
      ? and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        )
      : eq(teamSchema.teamMember.userId, userId);

    const [teamsRow] = await this.database
      .select({ total: count(teamSchema.teamMember.id) })
      .from(teamSchema.teamMember)
      .where(teamFilter);
    const teamsCount = Number(teamsRow?.total ?? 0);

    // If teamId or period is set, we need to join through retrospective
    let userCardRetros: { retroId: string }[];
    if (teamId || since) {
      const retroWhere = [
        eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
      ];
      if (teamId) retroWhere.push(eq(retroSchema.retrospective.teamId, teamId));
      if (since)
        retroWhere.push(gte(retroSchema.retrospective.completedAt, since));

      const scopedRetros = await this.database
        .select({ id: retroSchema.retrospective.id })
        .from(retroSchema.retrospective)
        .where(and(...retroWhere));

      const scopedRetroIds = scopedRetros.map((r) => r.id);
      if (scopedRetroIds.length === 0) {
        const emptyResult = {
          teamsCount,
          retroCount: 0,
          cardsCreated: 0,
          actionItemsAssigned: 0,
          actionItemsCompleted: 0,
          completionRate: 0,
        };
        return emptyResult;
      }

      // Cards in scoped retros by user
      userCardRetros = await this.database
        .selectDistinct({ retroId: retroSchema.card.retroId })
        .from(retroSchema.card)
        .where(
          and(
            eq(retroSchema.card.authorId, userId),
            inArray(retroSchema.card.retroId, scopedRetroIds),
          ),
        );

      const [cardsRow] = await this.database
        .select({ total: count(retroSchema.card.id) })
        .from(retroSchema.card)
        .where(
          and(
            eq(retroSchema.card.authorId, userId),
            inArray(retroSchema.card.retroId, scopedRetroIds),
          ),
        );
      const cardsCreated = Number(cardsRow?.total ?? 0);

      // Action items in scoped retros assigned to user
      const aiRows = await this.database
        .select({ status: retroSchema.actionItem.status })
        .from(retroSchema.actionItem)
        .where(
          and(
            eq(retroSchema.actionItem.assigneeId, userId),
            inArray(retroSchema.actionItem.retroId, scopedRetroIds),
          ),
        );

      const actionItemsAssigned = aiRows.length;
      const actionItemsCompleted = aiRows.filter(
        (r) => r.status === ACTION_ITEM_STATUSES.Completed,
      ).length;
      const completionRate =
        actionItemsAssigned > 0
          ? Math.round((actionItemsCompleted / actionItemsAssigned) * 100)
          : 0;

      const result = {
        teamsCount,
        retroCount: userCardRetros.length,
        cardsCreated,
        actionItemsAssigned,
        actionItemsCompleted,
        completionRate,
      };
      return result;
    }

    // No period/team filter — original all-time logic
    // Retros where user contributed at least one card
    userCardRetros = await this.database
      .selectDistinct({ retroId: retroSchema.card.retroId })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.authorId, userId));
    const retroCount = userCardRetros.length;

    // Cards created
    const [cardsRow] = await this.database
      .select({ total: count(retroSchema.card.id) })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.authorId, userId));
    const cardsCreated = Number(cardsRow?.total ?? 0);

    // Action items assigned
    const aiRows = await this.database
      .select({ status: retroSchema.actionItem.status })
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.assigneeId, userId));

    const actionItemsAssigned = aiRows.length;
    const actionItemsCompleted = aiRows.filter(
      (r) => r.status === ACTION_ITEM_STATUSES.Completed,
    ).length;
    const completionRate =
      actionItemsAssigned > 0
        ? Math.round((actionItemsCompleted / actionItemsAssigned) * 100)
        : 0;

    const result = {
      teamsCount,
      retroCount,
      cardsCreated,
      actionItemsAssigned,
      actionItemsCompleted,
      completionRate,
    };

    return result;
  }

  async getEstimateKPIs(
    userId: string,
    teamId: string,
    period: Period = 'month',
  ): Promise<EstimateKPIs> {
    await this.assertTeamMember(userId, teamId);

    const since = periodStart(period);

    // Completed sessions in period
    const sessions = await this.database
      .select({ id: estimateSchema.storyEstimateSession.id })
      .from(estimateSchema.storyEstimateSession)
      .where(
        and(
          eq(estimateSchema.storyEstimateSession.teamId, teamId),
          eq(
            estimateSchema.storyEstimateSession.status,
            ESTIMATE_SESSION_STATUSES.Completed,
          ),
          gte(estimateSchema.storyEstimateSession.createdAt, since),
        ),
      );

    const sessionIds = sessions.map((s) => s.id);
    const sessionsCompleted = sessionIds.length;

    if (sessionsCompleted === 0) {
      const emptyResult: EstimateKPIs = {
        sessionsCompleted: 0,
        storiesEstimated: 0,
        participationRate: 0,
        avgVotesPerStory: 0,
      };
      return emptyResult;
    }

    // Stories estimated (rounds with revealed results)
    const [roundsRow] = await this.database
      .select({ total: count(estimateSchema.storyEstimateRound.id) })
      .from(estimateSchema.storyEstimateRound)
      .where(
        and(
          inArray(estimateSchema.storyEstimateRound.sessionId, sessionIds),
          eq(
            estimateSchema.storyEstimateRound.status,
            ESTIMATE_ROUND_STATUSES.Revealed,
          ),
        ),
      );
    const storiesEstimated = Number(roundsRow?.total ?? 0);

    // Participation rate: unique voters / team size
    const [teamSizeRow] = await this.database
      .select({ total: count(teamSchema.teamMember.id) })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));
    const teamSize = Math.max(1, Number(teamSizeRow?.total ?? 1));

    const [uniqueVotersRow] = await this.database
      .select({
        total: countDistinct(estimateSchema.storyEstimateVote.voterId),
      })
      .from(estimateSchema.storyEstimateVote)
      .where(inArray(estimateSchema.storyEstimateVote.sessionId, sessionIds));
    const uniqueVoters = Number(uniqueVotersRow?.total ?? 0);
    const participationRate = Math.round((uniqueVoters / teamSize) * 100);

    // Avg votes per story
    const [totalVotesRow] = await this.database
      .select({ total: count(estimateSchema.storyEstimateVote.id) })
      .from(estimateSchema.storyEstimateVote)
      .where(inArray(estimateSchema.storyEstimateVote.sessionId, sessionIds));
    const totalVotes = Number(totalVotesRow?.total ?? 0);
    const avgVotesPerStory =
      storiesEstimated > 0
        ? Math.round((totalVotes / storiesEstimated) * 10) / 10
        : 0;

    const kpiResult: EstimateKPIs = {
      sessionsCompleted,
      storiesEstimated,
      participationRate,
      avgVotesPerStory,
    };

    return kpiResult;
  }

  async getOrgOverview(
    userId: string,
    orgId: string,
    period: Period,
    tbPage = 1,
    tbLimit = 8,
    tbSearch?: string,
  ): Promise<OrgOverview> {
    await this.assertOrgAdmin(userId, orgId);

    const normalizedTbSearch = tbSearch?.trim();

    const since = periodStart(period);

    // All teams in the org
    const teams = await this.database
      .select({ id: teamSchema.team.id, name: teamSchema.team.name })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.organizationId, orgId));

    const teamIds = teams.map((t) => t.id);

    if (teamIds.length === 0) {
      const emptyResult = {
        teamsCount: 0,
        membersCount: 0,
        retroCount: 0,
        totalCards: 0,
        totalVotes: 0,
        participationRate: 0,
        actionItemsCompleted: 0,
        actionItemsPending: 0,
        teamBreakdown: [],
        teamBreakdownTotal: 0,
        teamBreakdownPage: tbPage,
        teamBreakdownLimit: tbLimit,
        teamBreakdownTotalPages: 0,
      };

      return emptyResult;
    }

    // Members per team
    const memberRows = await this.database
      .select({
        teamId: teamSchema.teamMember.teamId,
        userId: teamSchema.teamMember.userId,
      })
      .from(teamSchema.teamMember)
      .where(inArray(teamSchema.teamMember.teamId, teamIds));

    const uniqueMemberIds = new Set(memberRows.map((m) => m.userId));
    const membersCount = uniqueMemberIds.size;

    const membersByTeam = new Map<string, Set<string>>();
    for (const m of memberRows) {
      if (!membersByTeam.has(m.teamId)) membersByTeam.set(m.teamId, new Set());
      membersByTeam.get(m.teamId)!.add(m.userId);
    }

    // Completed retros in period
    const retros = await this.database
      .select({
        id: retroSchema.retrospective.id,
        teamId: retroSchema.retrospective.teamId,
      })
      .from(retroSchema.retrospective)
      .where(
        and(
          inArray(retroSchema.retrospective.teamId, teamIds),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, since),
        ),
      );

    const retroCount = retros.length;
    const retroIds = retros.map((r) => r.id);
    const retrosByTeam = new Map<string, string[]>();
    for (const r of retros) {
      if (!retrosByTeam.has(r.teamId)) retrosByTeam.set(r.teamId, []);
      retrosByTeam.get(r.teamId)!.push(r.id);
    }

    // Cards and votes
    let totalCards = 0;
    let totalVotes = 0;
    const cardAuthorsByRetro = new Map<string, Set<string>>();

    if (retroIds.length > 0) {
      const cardRows = await this.database
        .select({
          id: retroSchema.card.id,
          retroId: retroSchema.card.retroId,
          authorId: retroSchema.card.authorId,
        })
        .from(retroSchema.card)
        .where(inArray(retroSchema.card.retroId, retroIds));

      totalCards = cardRows.length;
      const cardIds = cardRows.map((c) => c.id);

      for (const c of cardRows) {
        if (!cardAuthorsByRetro.has(c.retroId))
          cardAuthorsByRetro.set(c.retroId, new Set());
        if (c.authorId) cardAuthorsByRetro.get(c.retroId)!.add(c.authorId);
      }

      if (cardIds.length > 0) {
        const voteRows = await this.database
          .select({ id: retroSchema.vote.id })
          .from(retroSchema.vote)
          .where(inArray(retroSchema.vote.cardId, cardIds));
        totalVotes = voteRows.length;
      }
    }

    // Action items
    let actionItemsCompleted = 0;
    let actionItemsPending = 0;
    if (retroIds.length > 0) {
      const aiRows = await this.database
        .select({ status: retroSchema.actionItem.status })
        .from(retroSchema.actionItem)
        .where(inArray(retroSchema.actionItem.retroId, retroIds));
      actionItemsCompleted = aiRows.filter(
        (r) => r.status === ACTION_ITEM_STATUSES.Completed,
      ).length;
      actionItemsPending = aiRows.filter(
        (r) => r.status !== ACTION_ITEM_STATUSES.Completed,
      ).length;
    }

    // Participation rate: avg across teams (only count current team members)
    const teamBreakdown = teams.map((team) => {
      const teamRetroIds = retrosByTeam.get(team.id) ?? [];
      const teamMemberIds = membersByTeam.get(team.id) ?? new Set<string>();
      const teamMemberCount = teamMemberIds.size;

      const uniqueContributors = new Set(
        teamRetroIds.flatMap((rid) =>
          Array.from(cardAuthorsByRetro.get(rid) ?? []).filter((id) =>
            teamMemberIds.has(id),
          ),
        ),
      ).size;

      const participationRate =
        teamMemberCount > 0
          ? Math.min(
              100,
              Math.round((uniqueContributors / teamMemberCount) * 100),
            )
          : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        retroCount: teamRetroIds.length,
        memberCount: teamMemberCount,
        participationRate,
      };
    });

    const filteredTeamBreakdown = normalizedTbSearch
      ? teamBreakdown.filter((team) =>
          team.teamName
            .toLowerCase()
            .includes(normalizedTbSearch.toLowerCase()),
        )
      : teamBreakdown;

    const avgParticipationRate =
      teamBreakdown.length > 0
        ? Math.round(
            teamBreakdown.reduce((sum, t) => sum + t.participationRate, 0) /
              teamBreakdown.length,
          )
        : 0;

    const tbTotal = filteredTeamBreakdown.length;
    const tbOffset = (tbPage - 1) * tbLimit;
    const paginatedBreakdown = filteredTeamBreakdown.slice(
      tbOffset,
      tbOffset + tbLimit,
    );

    const result = {
      teamsCount: teams.length,
      membersCount,
      retroCount,
      totalCards,
      totalVotes,
      participationRate: avgParticipationRate,
      actionItemsCompleted,
      actionItemsPending,
      teamBreakdown: paginatedBreakdown,
      teamBreakdownTotal: tbTotal,
      teamBreakdownPage: tbPage,
      teamBreakdownLimit: tbLimit,
      teamBreakdownTotalPages: Math.ceil(tbTotal / tbLimit),
    };

    return result;
  }

  async getSystemOverview(
    userId: string,
    obPage = 1,
    obLimit = 8,
    obSearch?: string,
  ): Promise<SystemOverview> {
    await this.assertSystemAdmin(userId);

    const normalizedObSearch = obSearch?.trim();

    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // All orgs
    const orgs = await this.database
      .select({
        id: orgSchema.organization.id,
        name: orgSchema.organization.name,
      })
      .from(orgSchema.organization);

    const orgIds = orgs.map((o) => o.id);

    const [teamsCountRow] = await this.database
      .select({ total: count(teamSchema.team.id) })
      .from(teamSchema.team);
    const teamsCount = Number(teamsCountRow?.total ?? 0);

    const [usersCountRow] = await this.database
      .select({ total: count(authSchema.user.id) })
      .from(authSchema.user)
      .where(eq(authSchema.user.status, USER_STATUSES.Approved));
    const usersCount = Number(usersCountRow?.total ?? 0);

    // Retros and cards in last 30 days
    const recentRetros = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          gte(retroSchema.retrospective.completedAt, since30Days),
        ),
      );
    const recentRetroCount = recentRetros.length;
    const recentRetroIds = recentRetros.map((r) => r.id);

    let totalCards = 0;
    if (recentRetroIds.length > 0) {
      const [cardRow] = await this.database
        .select({ total: count(retroSchema.card.id) })
        .from(retroSchema.card)
        .where(inArray(retroSchema.card.retroId, recentRetroIds));
      totalCards = Number(cardRow?.total ?? 0);
    }

    // Per-org breakdown (efficient batch queries)
    let orgBreakdown: SystemOverview['orgBreakdown'] = [];

    if (orgIds.length > 0) {
      const allTeams = await this.database
        .select({
          id: teamSchema.team.id,
          organizationId: teamSchema.team.organizationId,
        })
        .from(teamSchema.team)
        .where(inArray(teamSchema.team.organizationId, orgIds));

      const allOrgMembers = await this.database
        .select({
          organizationId: orgSchema.organizationMember.organizationId,
          userId: orgSchema.organizationMember.userId,
        })
        .from(orgSchema.organizationMember)
        .where(inArray(orgSchema.organizationMember.organizationId, orgIds));

      const teamsByOrg = new Map<string, string[]>();
      for (const t of allTeams) {
        if (!teamsByOrg.has(t.organizationId))
          teamsByOrg.set(t.organizationId, []);
        teamsByOrg.get(t.organizationId)!.push(t.id);
      }

      const membersByOrg = new Map<string, Set<string>>();
      for (const m of allOrgMembers) {
        if (!membersByOrg.has(m.organizationId))
          membersByOrg.set(m.organizationId, new Set());
        membersByOrg.get(m.organizationId)!.add(m.userId);
      }

      // Retros per org in last 30 days
      const orgTeamIds = allTeams.map((t) => t.id);
      const recentRetrosByTeam = new Map<string, number>();

      if (orgTeamIds.length > 0 && recentRetroIds.length > 0) {
        const orgRetros = await this.database
          .select({
            teamId: retroSchema.retrospective.teamId,
            id: retroSchema.retrospective.id,
          })
          .from(retroSchema.retrospective)
          .where(
            and(
              inArray(retroSchema.retrospective.teamId, orgTeamIds),
              eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
              gte(retroSchema.retrospective.completedAt, since30Days),
            ),
          );

        for (const r of orgRetros) {
          recentRetrosByTeam.set(
            r.teamId,
            (recentRetrosByTeam.get(r.teamId) ?? 0) + 1,
          );
        }
      }

      orgBreakdown = orgs.map((org) => {
        const orgTeams = teamsByOrg.get(org.id) ?? [];
        const orgRetroCount = orgTeams.reduce(
          (sum, tid) => sum + (recentRetrosByTeam.get(tid) ?? 0),
          0,
        );
        return {
          orgId: org.id,
          orgName: org.name,
          teamsCount: orgTeams.length,
          membersCount: membersByOrg.get(org.id)?.size ?? 0,
          retroCount: orgRetroCount,
        };
      });
    }

    const filteredOrgBreakdown = normalizedObSearch
      ? orgBreakdown.filter((org) =>
          org.orgName.toLowerCase().includes(normalizedObSearch.toLowerCase()),
        )
      : orgBreakdown;

    const obTotal = filteredOrgBreakdown.length;
    const obOffset = (obPage - 1) * obLimit;
    const paginatedOrgBreakdown = filteredOrgBreakdown.slice(
      obOffset,
      obOffset + obLimit,
    );

    const result = {
      orgsCount: orgs.length,
      teamsCount,
      usersCount,
      retroCount: recentRetroCount,
      totalCards,
      orgBreakdown: paginatedOrgBreakdown,
      orgBreakdownTotal: obTotal,
      orgBreakdownPage: obPage,
      orgBreakdownLimit: obLimit,
      orgBreakdownTotalPages: Math.ceil(obTotal / obLimit),
    };

    return result;
  }
}
