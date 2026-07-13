import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import * as pollsSchema from './schema';
import * as standupsSchema from '../standups/schema';
import * as teamSchema from '../teams/schema';
import * as orgSchema from '../organizations/schema';
import * as authSchema from '../auth/schema';
import { generateId } from '../lib/utils';
import { EmailService } from '../email/email.service';
import { CreatePollDto, UpdatePollDto } from './dtos';
import {
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from '../common/enums';
import { assemblePollView, type PollVoterRow } from './helpers';
import type { Poll } from './schema';
import type { PollView } from './types';

type Database = NodePgDatabase<
  typeof pollsSchema &
    typeof standupsSchema &
    typeof teamSchema &
    typeof orgSchema &
    typeof authSchema
>;

@Injectable()
export class PollsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
  ) {}

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async getPollRecord(pollId: string): Promise<Poll> {
    const [record] = await this.database
      .select()
      .from(pollsSchema.poll)
      .where(eq(pollsSchema.poll.id, pollId))
      .limit(1);

    if (!record) throw new NotFoundException('Poll not found');
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
        'You must be a team member to access this poll',
      );
    }
  }

  private async canManagePoll(record: Poll, userId: string): Promise<boolean> {
    if (record.createdById === userId) return true;

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin
    ) {
      return true;
    }

    // Org owners and admins can manage any poll on a team in their org.
    const [team] = await this.database
      .select({ organizationId: teamSchema.team.organizationId })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, record.teamId))
      .limit(1);

    if (team?.organizationId) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(
              orgSchema.organizationMember.organizationId,
              team.organizationId,
            ),
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

    const [membership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, record.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return membership?.tag === TEAM_MEMBER_TAGS.Lead;
  }

  private async buildViews(userId: string, polls: Poll[]): Promise<PollView[]> {
    if (polls.length === 0) return [];

    const pollIds = polls.map((record) => record.id);
    const teamIds = [...new Set(polls.map((record) => record.teamId))];
    const creatorIds = [
      ...new Set(
        polls
          .map((record) => record.createdById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [options, votes, teams, creators, memberships] = await Promise.all([
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
      this.database
        .select({
          id: teamSchema.team.id,
          name: teamSchema.team.name,
          emoji: teamSchema.team.emoji,
          organizationId: teamSchema.team.organizationId,
        })
        .from(teamSchema.team)
        .where(inArray(teamSchema.team.id, teamIds)),
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
      this.database
        .select({
          teamId: teamSchema.teamMember.teamId,
          tag: teamSchema.teamMember.tag,
        })
        .from(teamSchema.teamMember)
        .where(
          and(
            inArray(teamSchema.teamMember.teamId, teamIds),
            eq(teamSchema.teamMember.userId, userId),
          ),
        ),
    ]);

    // Org roles let owners/admins manage every poll on their org's teams.
    const orgIds = [
      ...new Set(
        teams
          .map((row) => row.organizationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const orgMemberships =
      orgIds.length > 0
        ? await this.database
            .select({
              organizationId: orgSchema.organizationMember.organizationId,
              role: orgSchema.organizationMember.role,
            })
            .from(orgSchema.organizationMember)
            .where(
              and(
                inArray(orgSchema.organizationMember.organizationId, orgIds),
                eq(orgSchema.organizationMember.userId, userId),
              ),
            )
        : [];
    const manageableOrgIds = new Set(
      orgMemberships
        .filter(
          (row) =>
            row.role === ORG_MEMBER_ROLES.Owner ||
            row.role === ORG_MEMBER_ROLES.Admin,
        )
        .map((row) => row.organizationId),
    );

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);
    const isAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    return polls.map((record) => {
      const team = teams.find((row) => row.id === record.teamId) ?? {
        id: record.teamId,
        name: 'Unknown team',
        emoji: null,
        organizationId: null,
      };
      const createdBy =
        creators.find((row) => row.id === record.createdById) ?? null;
      const membership = memberships.find(
        (row) => row.teamId === record.teamId,
      );
      const isOrgManager = Boolean(
        team.organizationId && manageableOrgIds.has(team.organizationId),
      );
      const canManage =
        isAdmin ||
        record.createdById === userId ||
        isOrgManager ||
        membership?.tag === TEAM_MEMBER_TAGS.Lead;

      return assemblePollView(record, options, votes as PollVoterRow[], {
        currentUserId: userId,
        canManage,
        team,
        createdBy,
      });
    });
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /** Standalone polls (not attached to a standup) for the user's teams. */
  async getPolls(userId: string): Promise<PollView[]> {
    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    const teamIds = memberships.map((row) => row.teamId);
    if (teamIds.length === 0) return [];

    const polls = await this.database
      .select()
      .from(pollsSchema.poll)
      .where(
        and(
          inArray(pollsSchema.poll.teamId, teamIds),
          isNull(pollsSchema.poll.standupId),
        ),
      )
      .orderBy(desc(pollsSchema.poll.createdAt));

    return this.buildViews(userId, polls);
  }

  /** Count of open standalone polls the user hasn't voted on yet (nav badge). */
  async getActiveCount(userId: string): Promise<{ count: number }> {
    const polls = await this.getPolls(userId);
    return {
      count: polls.filter((poll) => !poll.isClosed && !poll.hasVoted).length,
    };
  }

  async getPoll(userId: string, pollId: string): Promise<PollView> {
    const record = await this.getPollRecord(pollId);
    await this.assertTeamMember(record.teamId, userId);
    const [view] = await this.buildViews(userId, [record]);
    return view;
  }

  /** Polls attached to a specific standup day (used by the daily room). */
  async getPollsForEntry(
    userId: string,
    standupId: string,
    entryDate: string,
  ): Promise<PollView[]> {
    const polls = await this.database
      .select()
      .from(pollsSchema.poll)
      .where(
        and(
          eq(pollsSchema.poll.standupId, standupId),
          eq(pollsSchema.poll.entryDate, entryDate),
        ),
      )
      .orderBy(desc(pollsSchema.poll.createdAt));

    return this.buildViews(userId, polls);
  }

  // ==========================================================================
  // Mutations
  // ==========================================================================

  async createPoll(
    userId: string,
    data: CreatePollDto,
  ): Promise<{
    id: string;
    standupId: string | null;
    entryDate: string | null;
  }> {
    await this.assertTeamMember(data.teamId, userId);

    if (data.standupId) {
      if (!data.entryDate) {
        throw new BadRequestException(
          'entryDate is required when attaching a poll to a standup',
        );
      }
      const [standupRecord] = await this.database
        .select({ teamId: standupsSchema.standup.teamId })
        .from(standupsSchema.standup)
        .where(eq(standupsSchema.standup.id, data.standupId))
        .limit(1);
      if (!standupRecord) {
        throw new NotFoundException('Standup not found');
      }
      if (standupRecord.teamId !== data.teamId) {
        throw new BadRequestException('Poll team must match the standup team');
      }
    }

    const id = generateId();

    await this.database.insert(pollsSchema.poll).values({
      id,
      question: data.question,
      teamId: data.teamId,
      standupId: data.standupId ?? null,
      entryDate: data.standupId ? (data.entryDate ?? null) : null,
      isAnonymous: data.isAnonymous,
      createdById: userId,
    });

    await this.database.insert(pollsSchema.pollOption).values(
      data.options.map((option, index) => ({
        id: generateId(),
        pollId: id,
        label: option.label,
        emoji: option.emoji ?? null,
        order: index,
      })),
    );

    return {
      id,
      standupId: data.standupId ?? null,
      entryDate: data.standupId ? (data.entryDate ?? null) : null,
    };
  }

  async vote(
    userId: string,
    pollId: string,
    optionId: string,
  ): Promise<{ standupId: string | null; entryDate: string | null }> {
    const record = await this.getPollRecord(pollId);
    await this.assertTeamMember(record.teamId, userId);

    if (record.isClosed) {
      throw new BadRequestException('This poll is closed');
    }

    const [option] = await this.database
      .select({ id: pollsSchema.pollOption.id })
      .from(pollsSchema.pollOption)
      .where(
        and(
          eq(pollsSchema.pollOption.id, optionId),
          eq(pollsSchema.pollOption.pollId, pollId),
        ),
      )
      .limit(1);

    if (!option) {
      throw new BadRequestException('Option does not belong to this poll');
    }

    // One vote per poll — changing your vote replaces the previous one.
    await this.database
      .delete(pollsSchema.pollVote)
      .where(
        and(
          eq(pollsSchema.pollVote.pollId, pollId),
          eq(pollsSchema.pollVote.userId, userId),
        ),
      );

    await this.database.insert(pollsSchema.pollVote).values({
      id: generateId(),
      pollId,
      optionId,
      userId,
    });

    return { standupId: record.standupId, entryDate: record.entryDate };
  }

  async retractVote(
    userId: string,
    pollId: string,
  ): Promise<{ standupId: string | null; entryDate: string | null }> {
    const record = await this.getPollRecord(pollId);

    if (record.isClosed) {
      throw new BadRequestException('This poll is closed');
    }

    await this.database
      .delete(pollsSchema.pollVote)
      .where(
        and(
          eq(pollsSchema.pollVote.pollId, pollId),
          eq(pollsSchema.pollVote.userId, userId),
        ),
      );

    return { standupId: record.standupId, entryDate: record.entryDate };
  }

  /**
   * Email the poll results to its team. Only a manager may send. Polls are
   * always team-scoped, so recipients (when provided) are restricted to the
   * poll's team members; when omitted, the whole team receives it.
   */
  async emailResults(
    userId: string,
    pollId: string,
    recipients?: string[],
  ): Promise<{ sent: number }> {
    const record = await this.getPollRecord(pollId);
    if (!(await this.canManagePoll(record, userId))) {
      throw new ForbiddenException('You cannot email results for this poll');
    }

    const teamMembers = await this.database
      .select({ email: authSchema.user.email })
      .from(teamSchema.teamMember)
      .innerJoin(
        authSchema.user,
        eq(authSchema.user.id, teamSchema.teamMember.userId),
      )
      .where(eq(teamSchema.teamMember.teamId, record.teamId));

    const allowed = new Set(
      teamMembers.map((member) => member.email.toLowerCase()),
    );

    let targets: string[];
    if (recipients && recipients.length > 0) {
      // Never email outside the poll's team, even if the client asks.
      targets = recipients.filter((email) => allowed.has(email.toLowerCase()));
    } else {
      targets = teamMembers.map((member) => member.email);
    }

    if (targets.length === 0) {
      throw new BadRequestException('No valid recipients for this poll');
    }

    const poll = await this.getPoll(userId, pollId);
    const html = this.emailService.buildPollResultsHtml({
      question: poll.question,
      teamName: poll.team.name,
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
    });

    let sent = 0;
    for (const email of targets) {
      const ok = await this.emailService.send({
        to: email,
        subject: `Poll Results: ${poll.question}`,
        html,
        userId,
        type: EMAIL_LOG_TYPES.PollResults,
      });
      if (ok) sent++;
    }

    return { sent };
  }

  async setClosed(
    userId: string,
    pollId: string,
    isClosed: boolean,
  ): Promise<{ standupId: string | null; entryDate: string | null }> {
    const record = await this.getPollRecord(pollId);

    const canManage = await this.canManagePoll(record, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can manage this poll',
      );
    }

    await this.database
      .update(pollsSchema.poll)
      .set({ isClosed, updatedAt: new Date() })
      .where(eq(pollsSchema.poll.id, pollId));

    return { standupId: record.standupId, entryDate: record.entryDate };
  }

  async updatePoll(
    userId: string,
    pollId: string,
    data: UpdatePollDto,
  ): Promise<{ standupId: string | null; entryDate: string | null }> {
    const record = await this.getPollRecord(pollId);

    const canManage = await this.canManagePoll(record, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can edit this poll',
      );
    }

    // Question / anonymity are simple field updates.
    const fields: Partial<typeof pollsSchema.poll.$inferInsert> = {};
    if (data.question !== undefined) fields.question = data.question;
    if (data.isAnonymous !== undefined) fields.isAnonymous = data.isAnonymous;

    if (Object.keys(fields).length > 0) {
      await this.database
        .update(pollsSchema.poll)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(pollsSchema.poll.id, pollId));
    }

    // Options are reconciled so that votes on kept options survive: options
    // carrying an existing `id` are updated in place, brand-new options are
    // inserted, and any option no longer present is deleted (its votes cascade).
    if (data.options !== undefined) {
      const existing = await this.database
        .select({ id: pollsSchema.pollOption.id })
        .from(pollsSchema.pollOption)
        .where(eq(pollsSchema.pollOption.pollId, pollId));
      const existingIds = new Set(existing.map((row) => row.id));

      const keptIds = new Set(
        data.options
          .map((option) => option.id)
          .filter((id): id is string => Boolean(id) && existingIds.has(id!)),
      );

      const removedIds = existing
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));
      if (removedIds.length > 0) {
        await this.database
          .delete(pollsSchema.pollOption)
          .where(inArray(pollsSchema.pollOption.id, removedIds));
      }

      for (const [index, option] of data.options.entries()) {
        if (option.id && existingIds.has(option.id)) {
          await this.database
            .update(pollsSchema.pollOption)
            .set({
              label: option.label,
              emoji: option.emoji ?? null,
              order: index,
            })
            .where(eq(pollsSchema.pollOption.id, option.id));
        } else {
          await this.database.insert(pollsSchema.pollOption).values({
            id: generateId(),
            pollId,
            label: option.label,
            emoji: option.emoji ?? null,
            order: index,
          });
        }
      }
    }

    return { standupId: record.standupId, entryDate: record.entryDate };
  }

  async deletePoll(
    userId: string,
    pollId: string,
  ): Promise<{ standupId: string | null; entryDate: string | null }> {
    const record = await this.getPollRecord(pollId);

    const canManage = await this.canManagePoll(record, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can delete this poll',
      );
    }

    await this.database
      .delete(pollsSchema.poll)
      .where(eq(pollsSchema.poll.id, pollId));

    return { standupId: record.standupId, entryDate: record.entryDate };
  }
}
