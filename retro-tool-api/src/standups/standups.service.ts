import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, gte, inArray, lte, sql } from 'drizzle-orm';
import * as standupsSchema from './schema';
import * as pollsSchema from '../polls/schema';
import * as icebreakersSchema from '../icebreakers/schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import {
  CreateStandupDto,
  UpdateStandupDto,
  SubmitStandupDto,
  CreateStandupCommentDto,
  SendStandupReportDto,
} from './dtos';
import {
  EMAIL_LOG_TYPES,
  ICEBREAKER_PROMPT_DECISIONS,
  NOTIFICATION_TYPES,
  ORG_MEMBER_ROLES,
  STANDUP_CADENCES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
  type TStandupCadence,
} from '../common/enums';
import type { Standup, StandupSubmission } from './schema';
import { assemblePollView, type PollVoterRow } from '../polls/helpers';
import type { PollView } from '../polls/types';
import type {
  IcebreakerEntrySession,
  StandupDetail,
  StandupEntryDetail,
  StandupSummary,
} from './types/index';

type Database = NodePgDatabase<
  typeof standupsSchema &
    typeof pollsSchema &
    typeof icebreakersSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class StandupsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  // ==========================================================================
  // Record / permission helpers
  // ==========================================================================

  private async getStandupRecord(standupId: string): Promise<Standup> {
    const [record] = await this.database
      .select()
      .from(standupsSchema.standup)
      .where(eq(standupsSchema.standup.id, standupId))
      .limit(1);

    if (!record) throw new NotFoundException('Standup not found');
    return record;
  }

  private async assertTeamMember(
    teamId: string,
    userId: string,
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

    if (!membership) {
      throw new ForbiddenException(
        'You must be a team member to access this standup',
      );
    }
  }

  async canManageStandup(standupId: string, userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({
        createdById: standupsSchema.standup.createdById,
        teamId: standupsSchema.standup.teamId,
        orgId: teamSchema.team.organizationId,
      })
      .from(standupsSchema.standup)
      .leftJoin(
        teamSchema.team,
        eq(standupsSchema.standup.teamId, teamSchema.team.id),
      )
      .where(eq(standupsSchema.standup.id, standupId))
      .limit(1);

    if (!row) throw new NotFoundException('Standup not found');

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

  // ==========================================================================
  // Schedule helpers
  // ==========================================================================

  private static parseDate(dateStr: string): Date {
    if (!DATE_PATTERN.test(dateStr)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }
    const parsed = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return parsed;
  }

  private static isScheduledDay(standup: Standup, dateStr: string): boolean {
    const target = StandupsService.parseDate(dateStr);

    // One-time standups occur only on the day they were created.
    if (standup.cadence === STANDUP_CADENCES.Once) {
      return dateStr === standup.createdAt.toISOString().slice(0, 10);
    }

    const dayCode = DAY_CODES[target.getUTCDay()];
    const scheduledDays = standup.scheduleDays
      .split(',')
      .map((day) => day.trim())
      .filter(Boolean);

    if (!scheduledDays.includes(dayCode)) return false;

    if (standup.cadence === STANDUP_CADENCES.Fortnightly) {
      // Anchor fortnights to the week the standup was created (Monday-based).
      const anchor = StandupsService.startOfIsoWeek(standup.createdAt);
      const targetWeek = StandupsService.startOfIsoWeek(target);
      const weeksBetween = Math.round(
        (targetWeek.getTime() - anchor.getTime()) / (7 * MS_PER_DAY),
      );
      return weeksBetween % 2 === 0;
    }

    return true;
  }

  private static startOfIsoWeek(input: Date): Date {
    const date = new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
    );
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    return date;
  }

  private static assertSubmittableDate(dateStr: string): void {
    const target = StandupsService.parseDate(dateStr);
    // Allow up to one day ahead of server UTC time so clients in timezones
    // ahead of the server can still submit for their local "today".
    const maxAllowed = Date.now() + MS_PER_DAY;
    if (target.getTime() > maxAllowed) {
      throw new BadRequestException(
        'You can only submit updates for today or past dates',
      );
    }
  }

  // ==========================================================================
  // Standup CRUD
  // ==========================================================================

  async getStandups(userId: string): Promise<StandupSummary[]> {
    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) return [];

    const standups = await this.database
      .select({
        standup: standupsSchema.standup,
        teamName: teamSchema.team.name,
        teamEmoji: teamSchema.team.emoji,
      })
      .from(standupsSchema.standup)
      .innerJoin(
        teamSchema.team,
        eq(standupsSchema.standup.teamId, teamSchema.team.id),
      )
      .where(inArray(standupsSchema.standup.teamId, teamIds))
      .orderBy(desc(standupsSchema.standup.createdAt));

    if (standups.length === 0) return [];

    const standupIds = standups.map((row) => row.standup.id);

    const questions = await this.database
      .select()
      .from(standupsSchema.standupQuestion)
      .where(inArray(standupsSchema.standupQuestion.standupId, standupIds))
      .orderBy(asc(standupsSchema.standupQuestion.order));

    const memberCounts = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(
        inArray(
          teamSchema.teamMember.teamId,
          standups.map((row) => row.standup.teamId),
        ),
      );

    const today = new Date().toISOString().slice(0, 10);

    const todayEntries = await this.database
      .select({
        id: standupsSchema.standupEntry.id,
        standupId: standupsSchema.standupEntry.standupId,
      })
      .from(standupsSchema.standupEntry)
      .where(
        and(
          inArray(standupsSchema.standupEntry.standupId, standupIds),
          eq(standupsSchema.standupEntry.entryDate, today),
        ),
      );

    const todayEntryIds = todayEntries.map((entry) => entry.id);
    const todaySubmissions =
      todayEntryIds.length > 0
        ? await this.database
            .select({
              entryId: standupsSchema.standupSubmission.entryId,
            })
            .from(standupsSchema.standupSubmission)
            .where(
              inArray(standupsSchema.standupSubmission.entryId, todayEntryIds),
            )
        : [];

    const skippedDays = await this.database
      .select({
        standupId: standupsSchema.standupSkippedDay.standupId,
        skipDate: standupsSchema.standupSkippedDay.skipDate,
      })
      .from(standupsSchema.standupSkippedDay)
      .where(inArray(standupsSchema.standupSkippedDay.standupId, standupIds));

    return standups.map(({ standup, teamName, teamEmoji }) => {
      const todayEntry = todayEntries.find(
        (entry) => entry.standupId === standup.id,
      );
      return {
        ...standup,
        team: { id: standup.teamId, name: teamName, emoji: teamEmoji },
        questions: questions
          .filter((question) => question.standupId === standup.id)
          .map((question) => ({
            id: question.id,
            prompt: question.prompt,
            color: question.color,
            order: question.order,
            isRequired: question.isRequired,
          })),
        memberCount: memberCounts.filter(
          (member) => member.teamId === standup.teamId,
        ).length,
        todaySubmissionCount: todayEntry
          ? todaySubmissions.filter(
              (submission) => submission.entryId === todayEntry.id,
            ).length
          : 0,
        skippedDays: skippedDays
          .filter((row) => row.standupId === standup.id)
          .map((row) => row.skipDate),
      };
    });
  }

  /**
   * Entry dates that actually have submissions, for all standups on the
   * user's teams within [from, to]. Drives the calendar's activity dots so
   * past days are only marked when something happened.
   */
  async getActivity(
    userId: string,
    from: string,
    to: string,
  ): Promise<
    { standupId: string; entryDate: string; submissionCount: number }[]
  > {
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      throw new BadRequestException('from/to must be YYYY-MM-DD');
    }

    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) return [];

    const rows = await this.database
      .select({
        standupId: standupsSchema.standupEntry.standupId,
        entryDate: standupsSchema.standupEntry.entryDate,
        submissionCount: sql<number>`count(${standupsSchema.standupSubmission.id})::int`,
      })
      .from(standupsSchema.standupEntry)
      .innerJoin(
        standupsSchema.standup,
        eq(standupsSchema.standupEntry.standupId, standupsSchema.standup.id),
      )
      .leftJoin(
        standupsSchema.standupSubmission,
        eq(
          standupsSchema.standupSubmission.entryId,
          standupsSchema.standupEntry.id,
        ),
      )
      .where(
        and(
          inArray(standupsSchema.standup.teamId, teamIds),
          gte(standupsSchema.standupEntry.entryDate, from),
          lte(standupsSchema.standupEntry.entryDate, to),
        ),
      )
      .groupBy(
        standupsSchema.standupEntry.standupId,
        standupsSchema.standupEntry.entryDate,
      );

    return rows.filter((row) => row.submissionCount > 0);
  }

  async createStandup(
    userId: string,
    data: CreateStandupDto,
  ): Promise<{ id: string }> {
    await this.assertTeamMember(data.teamId, userId);

    const id = generateId();

    await this.database.insert(standupsSchema.standup).values({
      id,
      name: data.name,
      teamId: data.teamId,
      cadence: data.cadence as TStandupCadence,
      scheduleDays: data.scheduleDays.join(','),
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      createdById: userId,
    });

    await this.database.insert(standupsSchema.standupQuestion).values(
      data.questions.map((question, index) => ({
        id: generateId(),
        standupId: id,
        prompt: question.prompt,
        color: question.color ?? null,
        order: index,
        isRequired: question.isRequired ?? true,
      })),
    );

    void this.notifyTeamOfStandupCreated(id, data.name, data.teamId).catch(
      () => undefined,
    );

    return { id };
  }

  async getStandup(userId: string, standupId: string): Promise<StandupDetail> {
    const record = await this.getStandupRecord(standupId);
    await this.assertTeamMember(record.teamId, userId);

    const [teamRow] = await this.database
      .select({ id: teamSchema.team.id, name: teamSchema.team.name })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, record.teamId))
      .limit(1);

    const questions = await this.database
      .select()
      .from(standupsSchema.standupQuestion)
      .where(eq(standupsSchema.standupQuestion.standupId, standupId))
      .orderBy(asc(standupsSchema.standupQuestion.order));

    const canManage = await this.canManageStandup(standupId, userId);

    const skippedRows = await this.database
      .select({ skipDate: standupsSchema.standupSkippedDay.skipDate })
      .from(standupsSchema.standupSkippedDay)
      .where(eq(standupsSchema.standupSkippedDay.standupId, standupId));

    return {
      ...record,
      isCreator: record.createdById === userId,
      canManage,
      currentUserId: userId,
      team: teamRow ?? { id: record.teamId, name: 'Unknown team' },
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        color: question.color,
        order: question.order,
        isRequired: question.isRequired,
      })),
      skippedDays: skippedRows.map((row) => row.skipDate),
    };
  }

  async updateStandup(
    userId: string,
    standupId: string,
    data: UpdateStandupDto,
  ): Promise<{ id: string }> {
    const record = await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can update this standup',
      );
    }

    await this.database
      .update(standupsSchema.standup)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.cadence !== undefined
          ? { cadence: data.cadence as TStandupCadence }
          : {}),
        ...(data.scheduleDays !== undefined
          ? { scheduleDays: data.scheduleDays.join(',') }
          : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(standupsSchema.standup.id, standupId));

    if (data.questions) {
      const existing = await this.database
        .select({ id: standupsSchema.standupQuestion.id })
        .from(standupsSchema.standupQuestion)
        .where(eq(standupsSchema.standupQuestion.standupId, standupId));

      const keptIds = new Set(
        data.questions
          .map((question) => question.id)
          .filter((questionId): questionId is string => Boolean(questionId)),
      );

      const removedIds = existing
        .map((question) => question.id)
        .filter((questionId) => !keptIds.has(questionId));

      if (removedIds.length > 0) {
        await this.database
          .delete(standupsSchema.standupQuestion)
          .where(inArray(standupsSchema.standupQuestion.id, removedIds));
      }

      for (const [index, question] of data.questions.entries()) {
        if (question.id && existing.some((row) => row.id === question.id)) {
          await this.database
            .update(standupsSchema.standupQuestion)
            .set({
              prompt: question.prompt,
              color: question.color ?? null,
              order: index,
              isRequired: question.isRequired ?? true,
            })
            .where(eq(standupsSchema.standupQuestion.id, question.id));
        } else {
          await this.database.insert(standupsSchema.standupQuestion).values({
            id: generateId(),
            standupId,
            prompt: question.prompt,
            color: question.color ?? null,
            order: index,
            isRequired: question.isRequired ?? true,
          });
        }
      }
    }

    return { id: record.id };
  }

  async deleteStandup(
    userId: string,
    standupId: string,
  ): Promise<{ success: boolean }> {
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can delete this standup',
      );
    }

    await this.database
      .delete(standupsSchema.standup)
      .where(eq(standupsSchema.standup.id, standupId));

    return { success: true };
  }

  // ==========================================================================
  // Daily entries (persistent rooms)
  // ==========================================================================

  private async getEntryPolls(
    userId: string,
    standupId: string,
    dateStr: string,
    context: {
      canManage: boolean;
      team: { id: string; name: string };
    },
  ): Promise<PollView[]> {
    const polls = await this.database
      .select()
      .from(pollsSchema.poll)
      .where(
        and(
          eq(pollsSchema.poll.standupId, standupId),
          eq(pollsSchema.poll.entryDate, dateStr),
        ),
      )
      .orderBy(asc(pollsSchema.poll.createdAt));

    if (polls.length === 0) return [];

    const pollIds = polls.map((record) => record.id);
    const creatorIds = [
      ...new Set(
        polls
          .map((record) => record.createdById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [options, votes, creators] = await Promise.all([
      this.database
        .select()
        .from(pollsSchema.pollOption)
        .where(inArray(pollsSchema.pollOption.pollId, pollIds)),
      this.database
        .select({
          id: pollsSchema.pollVote.id,
          pollId: pollsSchema.pollVote.pollId,
          optionId: pollsSchema.pollVote.optionId,
          userId: pollsSchema.pollVote.userId,
          createdAt: pollsSchema.pollVote.createdAt,
          userName: authSchema.user.name,
          userImage: authSchema.user.image,
        })
        .from(pollsSchema.pollVote)
        .innerJoin(
          authSchema.user,
          eq(pollsSchema.pollVote.userId, authSchema.user.id),
        )
        .where(inArray(pollsSchema.pollVote.pollId, pollIds)),
      creatorIds.length > 0
        ? this.database
            .select({
              id: authSchema.user.id,
              name: authSchema.user.name,
              image: authSchema.user.image,
            })
            .from(authSchema.user)
            .where(inArray(authSchema.user.id, creatorIds))
        : Promise.resolve([]),
    ]);

    return polls.map((record) =>
      assemblePollView(record, options, votes as PollVoterRow[], {
        currentUserId: userId,
        canManage: context.canManage || record.createdById === userId,
        team: { ...context.team, emoji: null },
        createdBy:
          creators.find((creator) => creator.id === record.createdById) ?? null,
      }),
    );
  }

  /**
   * Icebreaker sessions attached to a standup day, shaped as compact cards for
   * the feed. The full swipe/present runtime lives on the session page, so we
   * only surface counts and a manage flag here. Oldest first, to match polls.
   */
  private async getEntryIcebreakers(
    userId: string,
    standupId: string,
    dateStr: string,
    context: { canManage: boolean },
  ): Promise<IcebreakerEntrySession[]> {
    const sessions = await this.database
      .select({
        id: icebreakersSchema.icebreakerSession.id,
        name: icebreakersSchema.icebreakerSession.name,
        status: icebreakersSchema.icebreakerSession.status,
        createdById: icebreakersSchema.icebreakerSession.createdById,
      })
      .from(icebreakersSchema.icebreakerSession)
      .where(
        and(
          eq(icebreakersSchema.icebreakerSession.standupId, standupId),
          eq(icebreakersSchema.icebreakerSession.entryDate, dateStr),
        ),
      )
      .orderBy(asc(icebreakersSchema.icebreakerSession.createdAt));

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((session) => session.id);

    const [deckPrompts, participants] = await Promise.all([
      this.database
        .select({
          sessionId: icebreakersSchema.icebreakerSessionPrompt.sessionId,
          decision: icebreakersSchema.icebreakerSessionPrompt.decision,
        })
        .from(icebreakersSchema.icebreakerSessionPrompt)
        .where(
          inArray(
            icebreakersSchema.icebreakerSessionPrompt.sessionId,
            sessionIds,
          ),
        ),
      this.database
        .select({
          sessionId: icebreakersSchema.icebreakerParticipant.sessionId,
        })
        .from(icebreakersSchema.icebreakerParticipant)
        .where(
          inArray(
            icebreakersSchema.icebreakerParticipant.sessionId,
            sessionIds,
          ),
        ),
    ]);

    return sessions.map((session) => {
      const deck = deckPrompts.filter((row) => row.sessionId === session.id);
      return {
        id: session.id,
        name: session.name,
        status: session.status,
        promptCount: deck.length,
        keptCount: deck.filter(
          (row) => row.decision === ICEBREAKER_PROMPT_DECISIONS.Kept,
        ).length,
        participantCount: participants.filter(
          (row) => row.sessionId === session.id,
        ).length,
        canManage: context.canManage || session.createdById === userId,
      };
    });
  }

  async getEntryDetail(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<StandupEntryDetail> {
    StandupsService.parseDate(dateStr);

    const standupDetail = await this.getStandup(userId, standupId);

    const polls = await this.getEntryPolls(userId, standupId, dateStr, {
      canManage: standupDetail.canManage,
      team: standupDetail.team,
    });

    const icebreakers = await this.getEntryIcebreakers(
      userId,
      standupId,
      dateStr,
      { canManage: standupDetail.canManage },
    );

    const [entry] = await this.database
      .select()
      .from(standupsSchema.standupEntry)
      .where(
        and(
          eq(standupsSchema.standupEntry.standupId, standupId),
          eq(standupsSchema.standupEntry.entryDate, dateStr),
        ),
      )
      .limit(1);

    const members = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        name: authSchema.user.name,
        image: authSchema.user.image,
        jobRole: teamSchema.teamRole.name,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        authSchema.user,
        eq(teamSchema.teamMember.userId, authSchema.user.id),
      )
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .where(eq(teamSchema.teamMember.teamId, standupDetail.teamId));

    if (!entry) {
      return {
        standup: standupDetail,
        date: dateStr,
        entry: null,
        isScheduledDay:
          StandupsService.isScheduledDay(standupDetail, dateStr) &&
          !standupDetail.skippedDays.includes(dateStr),
        isSkipped: standupDetail.skippedDays.includes(dateStr),
        members: members.map((member) => ({
          userId: member.userId,
          name: member.name,
          image: member.image,
          jobRole: member.jobRole ?? null,
          hasSubmitted: false,
        })),
        submissions: [],
        polls,
        icebreakers,
      };
    }

    const submissions = await this.database
      .select({
        submission: standupsSchema.standupSubmission,
        userName: authSchema.user.name,
        userImage: authSchema.user.image,
      })
      .from(standupsSchema.standupSubmission)
      .innerJoin(
        authSchema.user,
        eq(standupsSchema.standupSubmission.userId, authSchema.user.id),
      )
      .where(eq(standupsSchema.standupSubmission.entryId, entry.id))
      .orderBy(asc(standupsSchema.standupSubmission.createdAt));

    const submissionIds = submissions.map((row) => row.submission.id);

    const [answers, comments, reactions] =
      submissionIds.length > 0
        ? await Promise.all([
            this.database
              .select()
              .from(standupsSchema.standupAnswer)
              .where(
                inArray(
                  standupsSchema.standupAnswer.submissionId,
                  submissionIds,
                ),
              ),
            this.database
              .select({
                comment: standupsSchema.standupComment,
                authorName: authSchema.user.name,
                authorImage: authSchema.user.image,
              })
              .from(standupsSchema.standupComment)
              .innerJoin(
                authSchema.user,
                eq(standupsSchema.standupComment.authorId, authSchema.user.id),
              )
              .where(
                inArray(
                  standupsSchema.standupComment.submissionId,
                  submissionIds,
                ),
              )
              .orderBy(asc(standupsSchema.standupComment.createdAt)),
            this.database
              .select({
                reaction: standupsSchema.standupReaction,
                userName: authSchema.user.name,
              })
              .from(standupsSchema.standupReaction)
              .innerJoin(
                authSchema.user,
                eq(standupsSchema.standupReaction.userId, authSchema.user.id),
              )
              .where(
                inArray(
                  standupsSchema.standupReaction.submissionId,
                  submissionIds,
                ),
              ),
          ])
        : [[], [], []];

    const submittedUserIds = new Set(
      submissions.map((row) => row.submission.userId),
    );

    return {
      standup: standupDetail,
      date: dateStr,
      entry: { id: entry.id, entryDate: entry.entryDate },
      isScheduledDay:
        StandupsService.isScheduledDay(standupDetail, dateStr) &&
        !standupDetail.skippedDays.includes(dateStr),
      isSkipped: standupDetail.skippedDays.includes(dateStr),
      members: members.map((member) => ({
        userId: member.userId,
        name: member.name,
        image: member.image,
        jobRole: member.jobRole ?? null,
        hasSubmitted: submittedUserIds.has(member.userId),
      })),
      submissions: submissions.map(({ submission, userName, userImage }) => ({
        id: submission.id,
        userId: submission.userId,
        user: { name: userName, image: userImage },
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        answers: answers
          .filter((answer) => answer.submissionId === submission.id)
          .map((answer) => ({
            questionId: answer.questionId,
            content: answer.content,
          })),
        comments: comments
          .filter((row) => row.comment.submissionId === submission.id)
          .map((row) => ({
            id: row.comment.id,
            authorId: row.comment.authorId,
            author: { name: row.authorName, image: row.authorImage },
            content: row.comment.content,
            createdAt: row.comment.createdAt,
          })),
        reactions: reactions
          .filter((row) => row.reaction.submissionId === submission.id)
          .map((row) => ({
            emoji: row.reaction.emoji,
            userId: row.reaction.userId,
            userName: row.userName,
          })),
      })),
      polls,
      icebreakers,
    };
  }

  // ==========================================================================
  // Submissions
  // ==========================================================================

  async upsertSubmission(
    userId: string,
    standupId: string,
    dateStr: string,
    data: SubmitStandupDto,
  ): Promise<{ submissionId: string; entryId: string }> {
    StandupsService.assertSubmittableDate(dateStr);

    const record = await this.getStandupRecord(standupId);
    await this.assertTeamMember(record.teamId, userId);

    if (!record.isActive) {
      throw new BadRequestException('This standup is no longer active');
    }

    const [skipRow] = await this.database
      .select({ id: standupsSchema.standupSkippedDay.id })
      .from(standupsSchema.standupSkippedDay)
      .where(
        and(
          eq(standupsSchema.standupSkippedDay.standupId, standupId),
          eq(standupsSchema.standupSkippedDay.skipDate, dateStr),
        ),
      )
      .limit(1);
    if (skipRow) {
      throw new BadRequestException('This standup day has been skipped');
    }

    const questions = await this.database
      .select()
      .from(standupsSchema.standupQuestion)
      .where(eq(standupsSchema.standupQuestion.standupId, standupId));

    const questionIds = new Set(questions.map((question) => question.id));
    for (const answer of data.answers) {
      if (!questionIds.has(answer.questionId)) {
        throw new BadRequestException(
          'Answer references a question that does not belong to this standup',
        );
      }
    }

    const answeredIds = new Set(
      data.answers
        .filter((answer) => answer.content.trim().length > 0)
        .map((answer) => answer.questionId),
    );
    const missingRequired = questions.find(
      (question) => question.isRequired && !answeredIds.has(question.id),
    );
    if (missingRequired) {
      throw new BadRequestException(
        `"${missingRequired.prompt}" requires an answer`,
      );
    }

    // Lazily create the persistent room for this date.
    let [entry] = await this.database
      .select()
      .from(standupsSchema.standupEntry)
      .where(
        and(
          eq(standupsSchema.standupEntry.standupId, standupId),
          eq(standupsSchema.standupEntry.entryDate, dateStr),
        ),
      )
      .limit(1);

    if (!entry) {
      const entryId = generateId();
      await this.database
        .insert(standupsSchema.standupEntry)
        .values({ id: entryId, standupId, entryDate: dateStr })
        .onConflictDoNothing();

      [entry] = await this.database
        .select()
        .from(standupsSchema.standupEntry)
        .where(
          and(
            eq(standupsSchema.standupEntry.standupId, standupId),
            eq(standupsSchema.standupEntry.entryDate, dateStr),
          ),
        )
        .limit(1);
    }

    if (!entry) {
      throw new BadRequestException('Could not open the standup room');
    }

    const [existingSubmission] = await this.database
      .select()
      .from(standupsSchema.standupSubmission)
      .where(
        and(
          eq(standupsSchema.standupSubmission.entryId, entry.id),
          eq(standupsSchema.standupSubmission.userId, userId),
        ),
      )
      .limit(1);

    let submissionId: string;

    if (existingSubmission) {
      submissionId = existingSubmission.id;
      await this.database
        .delete(standupsSchema.standupAnswer)
        .where(eq(standupsSchema.standupAnswer.submissionId, submissionId));
      await this.database
        .update(standupsSchema.standupSubmission)
        .set({ updatedAt: new Date() })
        .where(eq(standupsSchema.standupSubmission.id, submissionId));
    } else {
      submissionId = generateId();
      await this.database.insert(standupsSchema.standupSubmission).values({
        id: submissionId,
        entryId: entry.id,
        userId,
      });
    }

    const answersToInsert = data.answers.filter(
      (answer) => answer.content.trim().length > 0,
    );
    if (answersToInsert.length > 0) {
      await this.database.insert(standupsSchema.standupAnswer).values(
        answersToInsert.map((answer) => ({
          id: generateId(),
          submissionId,
          questionId: answer.questionId,
          content: answer.content,
        })),
      );
    }

    return { submissionId, entryId: entry.id };
  }

  async deleteSubmission(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<{ entryId: string }> {
    StandupsService.parseDate(dateStr);

    const record = await this.getStandupRecord(standupId);
    await this.assertTeamMember(record.teamId, userId);

    const [entry] = await this.database
      .select()
      .from(standupsSchema.standupEntry)
      .where(
        and(
          eq(standupsSchema.standupEntry.standupId, standupId),
          eq(standupsSchema.standupEntry.entryDate, dateStr),
        ),
      )
      .limit(1);

    if (!entry) {
      throw new NotFoundException('No standup room exists for this date');
    }

    const [submission] = await this.database
      .select()
      .from(standupsSchema.standupSubmission)
      .where(
        and(
          eq(standupsSchema.standupSubmission.entryId, entry.id),
          eq(standupsSchema.standupSubmission.userId, userId),
        ),
      )
      .limit(1);

    if (!submission) {
      throw new NotFoundException('You have no submission to delete');
    }

    // Answers, comments, and reactions cascade-delete via FK on the submission.
    await this.database
      .delete(standupsSchema.standupSubmission)
      .where(eq(standupsSchema.standupSubmission.id, submission.id));

    return { entryId: entry.id };
  }

  // ==========================================================================
  // Skipped days
  // ==========================================================================

  async skipDay(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<{ success: boolean }> {
    StandupsService.parseDate(dateStr);
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can skip a standup day',
      );
    }

    await this.database
      .insert(standupsSchema.standupSkippedDay)
      .values({
        id: generateId(),
        standupId,
        skipDate: dateStr,
        createdById: userId,
      })
      .onConflictDoNothing();

    return { success: true };
  }

  async unskipDay(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<{ success: boolean }> {
    StandupsService.parseDate(dateStr);
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can restore a skipped day',
      );
    }

    await this.database
      .delete(standupsSchema.standupSkippedDay)
      .where(
        and(
          eq(standupsSchema.standupSkippedDay.standupId, standupId),
          eq(standupsSchema.standupSkippedDay.skipDate, dateStr),
        ),
      );

    return { success: true };
  }

  // ==========================================================================
  // Reports (email)
  // ==========================================================================

  async sendStandupReport(
    userId: string,
    standupId: string,
    data: SendStandupReportDto,
  ): Promise<{ sent: number }> {
    const record = await this.getStandupRecord(standupId);
    await this.assertTeamMember(record.teamId, userId);

    const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
    const entryDetail = await this.getEntryDetail(userId, standupId, dateStr);

    // Resolve recipients: explicit list, or every team member's email.
    let recipients: string[];
    if (data.recipients && data.recipients.length > 0) {
      recipients = data.recipients;
    } else {
      const teamMembers = await this.database
        .select({ email: authSchema.user.email })
        .from(teamSchema.teamMember)
        .innerJoin(
          authSchema.user,
          eq(authSchema.user.id, teamSchema.teamMember.userId),
        )
        .where(eq(teamSchema.teamMember.teamId, record.teamId));
      recipients = teamMembers
        .map((member) => member.email)
        .filter((email): email is string => Boolean(email));
    }

    if (recipients.length === 0) {
      throw new BadRequestException('No recipients to send the report to');
    }

    const html = this.emailService.buildStandupReportHtml({
      standupName: entryDetail.standup.name,
      teamName: entryDetail.standup.team.name,
      date: this.formatReportDate(dateStr),
      submittedCount: entryDetail.members.filter(
        (member) => member.hasSubmitted,
      ).length,
      memberCount: entryDetail.members.length,
      submissions: entryDetail.submissions.map((submission) => ({
        userName: submission.user.name,
        submittedAt: new Date(submission.updatedAt).toLocaleString(),
        answers: entryDetail.standup.questions
          .map((question) => {
            const answer = submission.answers.find(
              (item) => item.questionId === question.id,
            );
            return answer && answer.content.trim().length > 0
              ? {
                  prompt: question.prompt,
                  content: answer.content,
                  color: question.color,
                }
              : null;
          })
          .filter(
            (
              item,
            ): item is {
              prompt: string;
              content: string;
              color: string | null;
            } => item !== null,
          ),
      })),
      polls: entryDetail.polls.map((poll) => ({
        question: poll.question,
        isAnonymous: poll.isAnonymous,
        totalVotes: poll.totalVotes,
        options: poll.options.map((option) => ({
          label: option.label,
          emoji: option.emoji,
          voteCount: option.voteCount,
          percent:
            poll.totalVotes > 0
              ? Math.round((option.voteCount / poll.totalVotes) * 100)
              : 0,
        })),
      })),
    });

    const subject = `Standup Report: ${entryDetail.standup.name} — ${this.formatReportDate(dateStr)}`;

    let sent = 0;
    for (const email of recipients) {
      const ok = await this.emailService.send({
        to: email,
        subject,
        html,
        userId,
        type: EMAIL_LOG_TYPES.StandupReport,
      });
      if (ok) sent += 1;
    }

    return { sent };
  }

  private formatReportDate(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  // ==========================================================================
  // Comments
  // ==========================================================================

  private async getSubmissionContext(submissionId: string): Promise<{
    submission: StandupSubmission;
    standupId: string;
    teamId: string;
    entryDate: string;
    standupName: string;
  }> {
    const [row] = await this.database
      .select({
        submission: standupsSchema.standupSubmission,
        standupId: standupsSchema.standupEntry.standupId,
        entryDate: standupsSchema.standupEntry.entryDate,
        teamId: standupsSchema.standup.teamId,
        standupName: standupsSchema.standup.name,
      })
      .from(standupsSchema.standupSubmission)
      .innerJoin(
        standupsSchema.standupEntry,
        eq(
          standupsSchema.standupSubmission.entryId,
          standupsSchema.standupEntry.id,
        ),
      )
      .innerJoin(
        standupsSchema.standup,
        eq(standupsSchema.standupEntry.standupId, standupsSchema.standup.id),
      )
      .where(eq(standupsSchema.standupSubmission.id, submissionId))
      .limit(1);

    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  async addComment(
    userId: string,
    submissionId: string,
    data: CreateStandupCommentDto,
  ): Promise<{ id: string; standupId: string; date: string }> {
    const context = await this.getSubmissionContext(submissionId);
    await this.assertTeamMember(context.teamId, userId);

    const commentId = generateId();

    await this.database.insert(standupsSchema.standupComment).values({
      id: commentId,
      submissionId,
      authorId: userId,
      content: data.content,
    });

    if (context.submission.userId !== userId) {
      void this.notificationsService
        .createAndEmit({
          userId: context.submission.userId,
          type: NOTIFICATION_TYPES.StandupCommentAdded,
          title: 'New comment on your standup update',
          message: data.content.slice(0, 120),
          link: `/standups/${context.standupId}?date=${context.entryDate}`,
        })
        .catch(() => undefined);
    }

    return {
      id: commentId,
      standupId: context.standupId,
      date: context.entryDate,
    };
  }

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<{ standupId: string; date: string }> {
    const [comment] = await this.database
      .select()
      .from(standupsSchema.standupComment)
      .where(eq(standupsSchema.standupComment.id, commentId))
      .limit(1);

    if (!comment) throw new NotFoundException('Comment not found');

    const context = await this.getSubmissionContext(comment.submissionId);

    if (comment.authorId !== userId) {
      const canManage = await this.canManageStandup(context.standupId, userId);
      if (!canManage) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await this.database
      .delete(standupsSchema.standupComment)
      .where(eq(standupsSchema.standupComment.id, commentId));

    return { standupId: context.standupId, date: context.entryDate };
  }

  // ==========================================================================
  // Reactions
  // ==========================================================================

  async addReaction(
    userId: string,
    submissionId: string,
    emoji: string,
  ): Promise<{ standupId: string; date: string }> {
    const context = await this.getSubmissionContext(submissionId);
    await this.assertTeamMember(context.teamId, userId);

    await this.database
      .insert(standupsSchema.standupReaction)
      .values({
        id: generateId(),
        submissionId,
        userId,
        emoji,
      })
      .onConflictDoNothing();

    return { standupId: context.standupId, date: context.entryDate };
  }

  async removeReaction(
    userId: string,
    submissionId: string,
    emoji: string,
  ): Promise<{ standupId: string; date: string }> {
    const context = await this.getSubmissionContext(submissionId);

    await this.database
      .delete(standupsSchema.standupReaction)
      .where(
        and(
          eq(standupsSchema.standupReaction.submissionId, submissionId),
          eq(standupsSchema.standupReaction.userId, userId),
          eq(standupsSchema.standupReaction.emoji, emoji),
        ),
      );

    return { standupId: context.standupId, date: context.entryDate };
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  private async notifyTeamOfStandupCreated(
    standupId: string,
    standupName: string,
    teamId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    await Promise.all(
      members.map((member) =>
        this.notificationsService.createAndEmit({
          userId: member.userId,
          type: NOTIFICATION_TYPES.StandupCreated,
          title: 'New standup',
          message: `A new standup "${standupName}" has been set up for your team.`,
          link: `/standups/${standupId}`,
        }),
      ),
    );
  }
}
