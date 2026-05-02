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
  asc,
  ilike,
  or,
  type SQL,
} from 'drizzle-orm';
import * as estimatesSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { StoryEstimateSession, StoryEstimateVote } from './schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateEstimateSessionDto,
  NewEstimateRoundDto,
  UpdateEstimateStoryDto,
} from './dtos';
import {
  ESTIMATE_SESSION_STATUSES,
  ESTIMATE_ROUND_STATUSES,
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  type TEstimateRoundStatus,
} from '../common/enums';
import type {
  EstimateVoteView,
  SessionDetail,
  SessionSummary,
} from './types/index';

type Database = NodePgDatabase<
  typeof estimatesSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

@Injectable()
export class EstimatesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async invalidateEstimateCaches(
    sessionId?: string,
    options: { invalidateLists?: boolean } = {},
  ): Promise<void> {
    void sessionId;
    void options;
    await Promise.resolve();
  }

  private roundStoryLabel(storyName: string, ticketNumber: string): string {
    const normalizedStoryName = storyName.trim();
    if (!normalizedStoryName || normalizedStoryName === ticketNumber) {
      return ticketNumber;
    }
    return `${ticketNumber} - ${normalizedStoryName}`;
  }

  private pointsToNumber(points: string): number | null {
    if (points === '½') return 0.5;
    const parsed = Number.parseFloat(points);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private computeRoundStats(votes: EstimateVoteView[]): {
    votesCount: number;
    average: number | null;
    min: number | null;
    max: number | null;
  } {
    if (votes.length === 0) {
      return { votesCount: 0, average: null, min: null, max: null };
    }

    const numericVotes = votes
      .map((vote) => this.pointsToNumber(vote.points))
      .filter((value): value is number => value !== null);

    if (numericVotes.length === 0) {
      return { votesCount: votes.length, average: null, min: null, max: null };
    }

    const average =
      numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length;
    const sorted = [...numericVotes].sort((a, b) => a - b);

    return {
      votesCount: votes.length,
      average: Number(average.toFixed(2)),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  private async getSessionRecord(
    sessionId: string,
  ): Promise<StoryEstimateSession> {
    const [session] = await this.database
      .select()
      .from(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async assertSessionCreator(
    sessionId: string,
    userId: string,
  ): Promise<StoryEstimateSession> {
    const session = await this.getSessionRecord(sessionId);
    if (session.createdById !== userId) {
      throw new ForbiddenException(
        'Only the session creator can do this action',
      );
    }
    return session;
  }

  async canManageSession(sessionId: string, userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({
        createdById: estimatesSchema.storyEstimateSession.createdById,
        teamId: estimatesSchema.storyEstimateSession.teamId,
        orgId: teamSchema.team.organizationId,
      })
      .from(estimatesSchema.storyEstimateSession)
      .leftJoin(
        teamSchema.team,
        eq(estimatesSchema.storyEstimateSession.teamId, teamSchema.team.id),
      )
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('Session not found');

    if (row.createdById === userId) return true;

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const role = fullUser?.role;

    if (role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin) {
      return true;
    }

    if (row.orgId) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.organizationId, row.orgId),
            eq(orgSchema.organizationMember.userId, userId),
          ),
        )
        .limit(1);

      if (
        orgMembership?.role === ORG_MEMBER_ROLES.Owner ||
        orgMembership?.role === ORG_MEMBER_ROLES.Admin
      ) {
        return true;
      }
    }

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, row.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return teamMembership?.tag === TEAM_MEMBER_TAGS.Lead;
  }

  private async assertCanDeleteSession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const canManage = await this.canManageSession(sessionId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to delete this session',
      );
    }
  }

  private async getCurrentRoundRecord(
    sessionId: string,
  ): Promise<typeof estimatesSchema.storyEstimateRound.$inferSelect | null> {
    const [currentRound] = await this.database
      .select()
      .from(estimatesSchema.storyEstimateRound)
      .where(
        and(
          eq(estimatesSchema.storyEstimateRound.sessionId, sessionId),
          eq(
            estimatesSchema.storyEstimateRound.status,
            ESTIMATE_ROUND_STATUSES.Active,
          ),
        ),
      )
      .orderBy(desc(estimatesSchema.storyEstimateRound.roundNumber))
      .limit(1);

    return currentRound ?? null;
  }

  private async createRound(
    sessionId: string,
    roundNumber: number,
    data: {
      storyName?: string;
      ticketNumber: string;
      storyDescription?: string;
      storyLink?: string;
    },
  ): Promise<typeof estimatesSchema.storyEstimateRound.$inferSelect> {
    const safeTicket = data.ticketNumber.trim();
    const safeStoryName = data.storyName?.trim() || safeTicket;

    const id = generateId();
    const [round] = await this.database
      .insert(estimatesSchema.storyEstimateRound)
      .values({
        id,
        sessionId,
        roundNumber,
        storyName: safeStoryName,
        ticketNumber: safeTicket,
        storyDescription: data.storyDescription,
        storyLink: data.storyLink,
        status: ESTIMATE_ROUND_STATUSES.Active,
      })
      .returning();

    if (!round) {
      throw new BadRequestException('Failed to create round');
    }

    return round;
  }

  private async closeCurrentRound(
    sessionId: string,
    status: TEstimateRoundStatus = ESTIMATE_ROUND_STATUSES.Closed,
  ): Promise<void> {
    const currentRound = await this.getCurrentRoundRecord(sessionId);
    if (!currentRound) return;

    await this.database
      .update(estimatesSchema.storyEstimateRound)
      .set({
        status,
        ...(status === ESTIMATE_ROUND_STATUSES.Revealed
          ? { revealedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateRound.id, currentRound.id));
  }

  async getSessions(userId: string): Promise<SessionSummary[]> {
    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    if (!memberships.length) return [];

    const teamIds = memberships.map((m) => m.teamId);

    const rows = await this.database
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
      .where(inArray(estimatesSchema.storyEstimateSession.teamId, teamIds));

    const summaries: SessionSummary[] = await Promise.all(
      rows.map(async (row) => {
        const participants = await this.database
          .select({
            userId: estimatesSchema.storyEstimateParticipant.userId,
            isOnline: estimatesSchema.storyEstimateParticipant.isOnline,
          })
          .from(estimatesSchema.storyEstimateParticipant)
          .where(
            eq(
              estimatesSchema.storyEstimateParticipant.sessionId,
              row.session.id,
            ),
          );

        return {
          ...row.session,
          team: row.team ?? { id: row.session.teamId, name: 'Unknown Team' },
          participants,
        };
      }),
    );

    return summaries;
  }

  async getActiveSessions(userId: string): Promise<SessionSummary[]> {
    const all = await this.getSessions(userId);
    return all.filter(
      (s) =>
        s.status === ESTIMATE_SESSION_STATUSES.Waiting ||
        s.status === ESTIMATE_SESSION_STATUSES.Voting,
    );
  }

  async getSession(userId: string, sessionId: string): Promise<SessionDetail> {
    // Fetch session + team + createdBy in one query
    const [row] = await this.database
      .select({
        session: estimatesSchema.storyEstimateSession,
        team: {
          id: teamSchema.team.id,
          name: teamSchema.team.name,
        },
        createdBy: {
          id: authSchema.user.id,
          name: authSchema.user.name,
          image: authSchema.user.image,
        },
      })
      .from(estimatesSchema.storyEstimateSession)
      .leftJoin(
        teamSchema.team,
        eq(estimatesSchema.storyEstimateSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        authSchema.user,
        eq(
          estimatesSchema.storyEstimateSession.createdById,
          authSchema.user.id,
        ),
      )
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('Session not found');

    // Check team membership
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

    if (!membership) throw new ForbiddenException('Access denied');

    // Fetch template if session has one
    let sessionTemplate: import('./types/index').SessionTemplate | null = null;
    if (row.session.templateId) {
      const [tmpl] = await this.database
        .select({
          id: estimatesSchema.estimateTemplate.id,
          name: estimatesSchema.estimateTemplate.name,
          color: estimatesSchema.estimateTemplate.color,
        })
        .from(estimatesSchema.estimateTemplate)
        .where(eq(estimatesSchema.estimateTemplate.id, row.session.templateId))
        .limit(1);

      if (tmpl) {
        const templateValues = await this.database
          .select()
          .from(estimatesSchema.estimateTemplateValue)
          .where(eq(estimatesSchema.estimateTemplateValue.templateId, tmpl.id))
          .orderBy(asc(estimatesSchema.estimateTemplateValue.order));

        sessionTemplate = {
          id: tmpl.id,
          name: tmpl.name,
          color: tmpl.color ?? null,
          values: templateValues.map((v) => ({
            id: v.id,
            label: v.label,
            value: v.value,
            order: v.order,
            color: v.color ?? null,
            description: v.description ?? null,
          })),
        };
      }
    }

    // Fetch participants with user info + jobRole from teamMember
    const rawParticipants = await this.database
      .select({
        id: estimatesSchema.storyEstimateParticipant.id,
        userId: estimatesSchema.storyEstimateParticipant.userId,
        isOnline: estimatesSchema.storyEstimateParticipant.isOnline,
        joinedAt: estimatesSchema.storyEstimateParticipant.joinedAt,
        userName: authSchema.user.name,
        userImage: authSchema.user.image,
        userId2: authSchema.user.id,
        jobRole: teamSchema.teamRole.name,
      })
      .from(estimatesSchema.storyEstimateParticipant)
      .innerJoin(
        authSchema.user,
        eq(estimatesSchema.storyEstimateParticipant.userId, authSchema.user.id),
      )
      .leftJoin(
        teamSchema.teamMember,
        and(
          eq(
            teamSchema.teamMember.userId,
            estimatesSchema.storyEstimateParticipant.userId,
          ),
          eq(teamSchema.teamMember.teamId, row.session.teamId),
        ),
      )
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .where(eq(estimatesSchema.storyEstimateParticipant.sessionId, sessionId));

    // Fetch rounds for this session
    const rounds = await this.database
      .select()
      .from(estimatesSchema.storyEstimateRound)
      .where(eq(estimatesSchema.storyEstimateRound.sessionId, sessionId))
      .orderBy(asc(estimatesSchema.storyEstimateRound.roundNumber));

    // Fetch votes with voter user info + their job role in this session's team
    const rawVotes = await this.database
      .select({
        id: estimatesSchema.storyEstimateVote.id,
        roundId: estimatesSchema.storyEstimateVote.roundId,
        voterId: estimatesSchema.storyEstimateVote.voterId,
        points: estimatesSchema.storyEstimateVote.points,
        votedAt: estimatesSchema.storyEstimateVote.votedAt,
        voterName: authSchema.user.name,
        voterId2: authSchema.user.id,
        voterJobRole: teamSchema.teamRole.name,
      })
      .from(estimatesSchema.storyEstimateVote)
      .innerJoin(
        authSchema.user,
        eq(estimatesSchema.storyEstimateVote.voterId, authSchema.user.id),
      )
      .leftJoin(
        teamSchema.teamMember,
        and(
          eq(
            teamSchema.teamMember.userId,
            estimatesSchema.storyEstimateVote.voterId,
          ),
          eq(teamSchema.teamMember.teamId, row.session.teamId),
        ),
      )
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .where(eq(estimatesSchema.storyEstimateVote.sessionId, sessionId));

    const participants = rawParticipants.map((p) => ({
      id: p.id,
      userId: p.userId,
      isOnline: p.isOnline,
      joinedAt: p.joinedAt,
      user: {
        id: p.userId2,
        name: p.userName,
        image: p.userImage,
        jobRole: p.jobRole ?? null,
      },
    }));

    const legacyVotes = rawVotes.filter((vote) => !vote.roundId);

    const legacyRound =
      rounds.length === 0 && legacyVotes.length > 0
        ? {
            id: 'legacy-round',
            roundNumber: 1,
            storyName: row.session.currentStory ?? 'Legacy story',
            ticketNumber: 'LEGACY',
            storyDescription: null,
            storyLink: null,
            agreedPoints: null,
            status: ESTIMATE_ROUND_STATUSES.Revealed,
            revealedAt: row.session.updatedAt,
            createdAt: row.session.createdAt,
            updatedAt: row.session.updatedAt,
          }
        : null;

    const allRounds = legacyRound ? [legacyRound, ...rounds] : rounds;
    const votesByRound = new Map<string, typeof rawVotes>();
    for (const vote of rawVotes) {
      const fallbackRoundId =
        legacyRound && !vote.roundId ? legacyRound.id : vote.roundId;
      if (!fallbackRoundId) continue;
      if (!votesByRound.has(fallbackRoundId)) {
        votesByRound.set(fallbackRoundId, []);
      }
      votesByRound.get(fallbackRoundId)?.push(vote);
    }

    const isCreator = row.session.createdById === userId;

    const currentRoundId = row.session.currentRoundId;
    const currentRound =
      allRounds.find((round) => round.id === currentRoundId) ??
      allRounds.find(
        (round) => round.status === ESTIMATE_ROUND_STATUSES.Active,
      ) ??
      null;

    const roundViews = allRounds.map((round) => {
      const roundVoteRows = votesByRound.get(round.id) ?? [];
      const shouldRevealRoundVotes =
        row.session.status === ESTIMATE_SESSION_STATUSES.Completed ||
        round.status !== ESTIMATE_ROUND_STATUSES.Active ||
        (currentRound &&
          round.id === currentRound.id &&
          row.session.status === ESTIMATE_SESSION_STATUSES.Revealed);

      const roundVotes: EstimateVoteView[] = roundVoteRows.map((vote) => {
        const isOwnVote = vote.voterId === userId;
        const visiblePoints =
          shouldRevealRoundVotes || isOwnVote ? vote.points : '?';
        return {
          id: vote.id,
          voterId: vote.voterId,
          userId: vote.voterId,
          points: visiblePoints,
          value: visiblePoints,
          user: {
            id: vote.voterId2,
            name: vote.voterName,
            jobRole: vote.voterJobRole ?? null,
          },
        };
      });

      return {
        id: round.id,
        roundNumber: round.roundNumber,
        storyName: round.storyName,
        ticketNumber: round.ticketNumber,
        storyDescription: round.storyDescription ?? null,
        storyLink: round.storyLink ?? null,
        status: round.status,
        agreedPoints: round.agreedPoints ?? null,
        revealedAt: round.revealedAt ?? null,
        createdAt: round.createdAt,
        updatedAt: round.updatedAt,
        votes: roundVotes,
        stats: this.computeRoundStats(roundVotes),
      };
    });

    const currentRoundVotes = currentRound
      ? (roundViews.find((round) => round.id === currentRound.id)?.votes ?? [])
      : [];

    const userVote =
      currentRoundVotes.find((v) => v.voterId === userId)?.points ?? null;

    const canEndSession = await this.canManageSession(sessionId, userId);

    const result: SessionDetail = {
      ...row.session,
      isCreator,
      canEndSession,
      currentUserId: userId,
      userVote,
      template: sessionTemplate,
      currentStory: currentRound
        ? this.roundStoryLabel(
            currentRound.storyName,
            currentRound.ticketNumber,
          )
        : row.session.currentStory,
      team: row.team ?? { id: row.session.teamId, name: 'Unknown Team' },
      createdBy: row.createdBy ?? {
        id: row.session.createdById,
        name: 'Unknown',
        image: null,
      },
      participants,
      votes: currentRoundVotes,
      currentRound: currentRound
        ? {
            id: currentRound.id,
            roundNumber: currentRound.roundNumber,
            storyName: currentRound.storyName,
            ticketNumber: currentRound.ticketNumber,
            storyDescription: currentRound.storyDescription ?? null,
            storyLink: currentRound.storyLink ?? null,
            status: currentRound.status,
            createdAt: currentRound.createdAt,
          }
        : null,
      rounds: roundViews,
    };

    return result;
  }

  async createSession(
    userId: string,
    data: CreateEstimateSessionDto,
  ): Promise<{ id: string }> {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, data.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Access denied');

    const id = generateId();
    const now = new Date();

    await this.database.insert(estimatesSchema.storyEstimateSession).values({
      id,
      name: data.name,
      teamId: data.teamId,
      createdById: userId,
      status: ESTIMATE_SESSION_STATUSES.Waiting,
      sprintLink: data.sprintLink,
      timerDuration: data.timerDuration,
      templateId: data.templateId ?? null,
      currentStory: null,
      createdAt: now,
      updatedAt: now,
    });

    void this.notificationsService
      .notifyTeamOfEstimateSession(id, data.name, data.teamId)
      .catch(() => undefined);

    await this.invalidateEstimateCaches(id, { invalidateLists: true });

    return { id };
  }

  // ============================================================================
  // Gateway helper methods
  // ============================================================================

  async isSessionCreator(sessionId: string, userId: string): Promise<boolean> {
    const [session] = await this.database
      .select({ createdById: estimatesSchema.storyEstimateSession.createdById })
      .from(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    return session?.createdById === userId;
  }

  async upsertParticipant(
    sessionId: string,
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    const [existing] = await this.database
      .select({ id: estimatesSchema.storyEstimateParticipant.id })
      .from(estimatesSchema.storyEstimateParticipant)
      .where(
        and(
          eq(estimatesSchema.storyEstimateParticipant.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateParticipant.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.database
        .update(estimatesSchema.storyEstimateParticipant)
        .set({ isOnline })
        .where(eq(estimatesSchema.storyEstimateParticipant.id, existing.id));
    } else {
      await this.database
        .insert(estimatesSchema.storyEstimateParticipant)
        .values({
          id: generateId(),
          sessionId,
          userId,
          isOnline,
        });
    }

    await this.invalidateEstimateCaches(sessionId);
  }

  async getParticipant(
    sessionId: string,
    userId: string,
  ): Promise<
    | {
        id: string;
        sessionId: string;
        userId: string;
        isOnline: boolean;
        joinedAt: Date;
      }
    | undefined
  > {
    const [participant] = await this.database
      .select()
      .from(estimatesSchema.storyEstimateParticipant)
      .where(
        and(
          eq(estimatesSchema.storyEstimateParticipant.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateParticipant.userId, userId),
        ),
      )
      .limit(1);

    return participant;
  }

  async upsertVote(
    sessionId: string,
    voterId: string,
    points: string,
  ): Promise<void> {
    const session = await this.getSessionRecord(sessionId);
    const currentRoundId = session.currentRoundId;
    if (!currentRoundId) {
      throw new BadRequestException(
        'No active story round. Host must add a story before voting.',
      );
    }

    const [round] = await this.database
      .select({
        id: estimatesSchema.storyEstimateRound.id,
        status: estimatesSchema.storyEstimateRound.status,
      })
      .from(estimatesSchema.storyEstimateRound)
      .where(eq(estimatesSchema.storyEstimateRound.id, currentRoundId))
      .limit(1);

    if (!round || round.status !== ESTIMATE_ROUND_STATUSES.Active) {
      throw new BadRequestException(
        'This round is not active. Ask the host to start a new round.',
      );
    }

    const [existing] = await this.database
      .select({ id: estimatesSchema.storyEstimateVote.id })
      .from(estimatesSchema.storyEstimateVote)
      .where(
        and(
          eq(estimatesSchema.storyEstimateVote.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateVote.roundId, currentRoundId),
          eq(estimatesSchema.storyEstimateVote.voterId, voterId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.database
        .update(estimatesSchema.storyEstimateVote)
        .set({ points, votedAt: new Date() })
        .where(eq(estimatesSchema.storyEstimateVote.id, existing.id));
    } else {
      await this.database.insert(estimatesSchema.storyEstimateVote).values({
        id: generateId(),
        sessionId,
        roundId: currentRoundId,
        voterId,
        points,
      });
    }

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({ status: ESTIMATE_SESSION_STATUSES.Voting, updatedAt: new Date() })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId);
  }

  async removeVote(sessionId: string, voterId: string): Promise<void> {
    const session = await this.getSessionRecord(sessionId);
    if (!session.currentRoundId) return;

    await this.database
      .delete(estimatesSchema.storyEstimateVote)
      .where(
        and(
          eq(estimatesSchema.storyEstimateVote.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateVote.roundId, session.currentRoundId),
          eq(estimatesSchema.storyEstimateVote.voterId, voterId),
        ),
      );

    await this.invalidateEstimateCaches(sessionId);
  }

  async revealVotes(
    sessionId: string,
    userId: string,
  ): Promise<StoryEstimateVote[]> {
    const session = await this.assertSessionCreator(sessionId, userId);
    if (!session.currentRoundId) {
      throw new BadRequestException('No active round found for this session');
    }

    await this.closeCurrentRound(sessionId, ESTIMATE_ROUND_STATUSES.Revealed);

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({
        status: ESTIMATE_SESSION_STATUSES.Revealed,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId, { invalidateLists: true });

    return this.database
      .select()
      .from(estimatesSchema.storyEstimateVote)
      .where(
        and(
          eq(estimatesSchema.storyEstimateVote.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateVote.roundId, session.currentRoundId),
        ),
      );
  }

  async clearVotes(
    sessionId: string,
    userId: string,
    newRound: NewEstimateRoundDto,
  ): Promise<void> {
    await this.startRound(sessionId, userId, newRound);
  }

  async startRound(
    sessionId: string,
    userId: string,
    newRound: NewEstimateRoundDto,
  ): Promise<void> {
    await this.assertSessionCreator(sessionId, userId);
    const session = await this.getSessionRecord(sessionId);
    if (session.status === ESTIMATE_SESSION_STATUSES.Completed) {
      throw new BadRequestException(
        'Cannot start rounds in a completed session',
      );
    }

    const allRounds = await this.database
      .select({ roundNumber: estimatesSchema.storyEstimateRound.roundNumber })
      .from(estimatesSchema.storyEstimateRound)
      .where(eq(estimatesSchema.storyEstimateRound.sessionId, sessionId))
      .orderBy(desc(estimatesSchema.storyEstimateRound.roundNumber))
      .limit(1);

    const nextRoundNumber = (allRounds[0]?.roundNumber ?? 0) + 1;

    if (session.currentRoundId) {
      await this.closeCurrentRound(sessionId, ESTIMATE_ROUND_STATUSES.Closed);
    }

    const createdRound = await this.createRound(sessionId, nextRoundNumber, {
      storyName: newRound.storyName,
      ticketNumber: newRound.ticketNumber,
      storyDescription: newRound.storyDescription,
      storyLink: newRound.storyLink,
    });

    const autoTimerEndsAt = session.timerDuration
      ? new Date(Date.now() + session.timerDuration * 1000)
      : null;

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({
        status: ESTIMATE_SESSION_STATUSES.Voting,
        currentRoundId: createdRound.id,
        currentStory: this.roundStoryLabel(
          createdRound.storyName,
          createdRound.ticketNumber,
        ),
        timerEndsAt: autoTimerEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId, { invalidateLists: true });
  }

  async updateStory(
    sessionId: string,
    userId: string,
    data: UpdateEstimateStoryDto,
  ): Promise<void> {
    const session = await this.assertSessionCreator(sessionId, userId);
    if (!session.currentRoundId) {
      throw new BadRequestException('No active round found for this session');
    }

    await this.database
      .update(estimatesSchema.storyEstimateRound)
      .set({
        storyName: data.storyName,
        ticketNumber: data.ticketNumber,
        storyDescription: data.storyDescription,
        storyLink: data.storyLink,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateRound.id, session.currentRoundId));

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({
        currentStory: this.roundStoryLabel(data.storyName, data.ticketNumber),
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId);
  }

  async startTimer(
    sessionId: string,
    userId: string,
    duration: number,
  ): Promise<Date> {
    await this.assertSessionCreator(sessionId, userId);

    const timerEndsAt = new Date(Date.now() + duration * 1000);

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({ timerDuration: duration, timerEndsAt, updatedAt: new Date() })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId);

    return timerEndsAt;
  }

  async updateSessionName(
    sessionId: string,
    name: string,
  ): Promise<StoryEstimateSession> {
    const [existing] = await this.database
      .select()
      .from(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .limit(1);

    if (!existing) throw new NotFoundException('Session not found');

    const [updated] = await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({ name, updatedAt: new Date() })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId))
      .returning();

    await this.invalidateEstimateCaches(sessionId, { invalidateLists: true });

    return updated;
  }

  async endSession(sessionId: string, userId: string): Promise<void> {
    const canManage = await this.canManageSession(sessionId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the session creator, team lead, or admin can end this session',
      );
    }

    await this.closeCurrentRound(sessionId, ESTIMATE_ROUND_STATUSES.Closed);

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({
        currentRoundId: null,
        status: ESTIMATE_SESSION_STATUSES.Completed,
        timerEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId, { invalidateLists: true });
  }

  async setConsensus(
    sessionId: string,
    userId: string,
    agreedPoints: string,
  ): Promise<void> {
    const session = await this.assertSessionCreator(sessionId, userId);
    if (session.status !== ESTIMATE_SESSION_STATUSES.Revealed) {
      throw new BadRequestException(
        'Consensus can only be set after votes are revealed',
      );
    }
    if (!session.currentRoundId) {
      throw new BadRequestException('No active round found for this session');
    }

    await this.database
      .update(estimatesSchema.storyEstimateRound)
      .set({ agreedPoints, updatedAt: new Date() })
      .where(eq(estimatesSchema.storyEstimateRound.id, session.currentRoundId));

    await this.invalidateEstimateCaches(sessionId);
  }

  async revote(sessionId: string, userId: string): Promise<void> {
    const session = await this.assertSessionCreator(sessionId, userId);
    if (session.status !== ESTIMATE_SESSION_STATUSES.Revealed) {
      throw new BadRequestException(
        'Revote can only be triggered after votes are revealed',
      );
    }
    if (!session.currentRoundId) {
      throw new BadRequestException('No active round found for this session');
    }

    await this.database
      .delete(estimatesSchema.storyEstimateVote)
      .where(
        and(
          eq(estimatesSchema.storyEstimateVote.sessionId, sessionId),
          eq(estimatesSchema.storyEstimateVote.roundId, session.currentRoundId),
        ),
      );

    await this.database
      .update(estimatesSchema.storyEstimateRound)
      .set({
        status: ESTIMATE_ROUND_STATUSES.Active,
        revealedAt: null,
        agreedPoints: null,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateRound.id, session.currentRoundId));

    const revoteTimerEndsAt = session.timerDuration
      ? new Date(Date.now() + session.timerDuration * 1000)
      : null;

    await this.database
      .update(estimatesSchema.storyEstimateSession)
      .set({
        status: ESTIMATE_SESSION_STATUSES.Voting,
        timerEndsAt: revoteTimerEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.assertCanDeleteSession(sessionId, userId);

    await this.database
      .delete(estimatesSchema.storyEstimateSession)
      .where(eq(estimatesSchema.storyEstimateSession.id, sessionId));

    await this.invalidateEstimateCaches(sessionId, { invalidateLists: true });
  }

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

        return {
          ...row,
          participantCount: pc?.total ?? 0,
          roundCount,
          storiesEstimated:
            roundCount > 0 ? roundCount : row.currentStory ? 1 : 0,
          totalVotes: vc?.total ?? 0,
          canDelete,
        };
      }),
    );

    return { sessions, total: totalRow?.total ?? 0, page, limit };
  }
}
