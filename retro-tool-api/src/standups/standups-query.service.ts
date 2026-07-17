import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, gte, inArray, lte, sql } from 'drizzle-orm';
import * as standupsSchema from './schema';
import * as teamSchema from '../teams/schema';
import { DATE_PATTERN } from './standups.utils';
import type { StandupSummary } from './types/index';

type Database = NodePgDatabase<typeof standupsSchema & typeof teamSchema>;

/**
 * Cross-standup list + calendar aggregation queries. Split out of
 * StandupsService so the fan-out reads that power the standups list and the
 * activity calendar live in one place, separate from the per-standup CRUD.
 */
@Injectable()
export class StandupsQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

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
}
