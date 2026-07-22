import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, inArray } from 'drizzle-orm';
import * as standupsSchema from './schema';
import * as pollsSchema from '../polls/schema';
import * as icebreakersSchema from '../icebreakers/schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import { ICEBREAKER_PROMPT_DECISIONS } from '../common/enums';
import { assemblePollView, type PollVoterRow } from '../polls/helpers';
import type { PollView } from '../polls/types';
import { StandupsService } from './standups.service';
import { isScheduledDay, parseDate } from './standups.utils';
import type { IcebreakerEntrySession, StandupEntryDetail } from './types/index';

type Database = NodePgDatabase<
  typeof standupsSchema &
    typeof pollsSchema &
    typeof icebreakersSchema &
    typeof teamSchema &
    typeof authSchema
>;

/**
 * Read-side assembly for a single daily standup room (submissions, answers,
 * comments, reactions, polls, icebreakers). Split out of StandupsService as the
 * heaviest fan-out read in the module; delegates standup config + access checks
 * back to StandupsService.
 */
@Injectable()
export class StandupsEntriesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly standupsService: StandupsService,
  ) {}

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
    parseDate(dateStr);

    const standupDetail = await this.standupsService.getStandup(
      userId,
      standupId,
    );

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
          isScheduledDay(standupDetail, dateStr) &&
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
        isScheduledDay(standupDetail, dateStr) &&
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
}
