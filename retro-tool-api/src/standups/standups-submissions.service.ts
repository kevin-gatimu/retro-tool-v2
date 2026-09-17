import { reportBestEffortFailure } from '../common/best-effort';
import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as standupsSchema from './schema';
import { generateId } from '../lib/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStandupCommentDto, SubmitStandupDto } from './dtos';
import { NOTIFICATION_TYPES } from '../common/enums';
import type { StandupSubmission } from './schema';
import { StandupsService } from './standups.service';
import { assertSubmittableDate, parseDate } from './standups.utils';

type Database = NodePgDatabase<typeof standupsSchema>;

/**
 * Member participation on a standup day: submissions, comments, and reactions.
 * Split out of StandupsService so the write-heavy member interactions live
 * apart from standup configuration; delegates record lookup + access checks
 * back to StandupsService.
 */
@Injectable()
export class StandupsSubmissionsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly standupsService: StandupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async upsertSubmission(
    userId: string,
    standupId: string,
    dateStr: string,
    data: SubmitStandupDto,
  ): Promise<{ submissionId: string; entryId: string }> {
    assertSubmittableDate(dateStr);

    const record = await this.standupsService.getStandupRecord(standupId);
    await this.standupsService.assertTeamMember(record.teamId, userId);

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
    parseDate(dateStr);

    const record = await this.standupsService.getStandupRecord(standupId);
    await this.standupsService.assertTeamMember(record.teamId, userId);

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
    await this.standupsService.assertTeamMember(context.teamId, userId);

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
        .catch(reportBestEffortFailure('Standup notification'));
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
      const canManage = await this.standupsService.canManageStandup(
        context.standupId,
        userId,
      );
      if (!canManage) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await this.database
      .delete(standupsSchema.standupComment)
      .where(eq(standupsSchema.standupComment.id, commentId));

    return { standupId: context.standupId, date: context.entryDate };
  }

  async addReaction(
    userId: string,
    submissionId: string,
    emoji: string,
  ): Promise<{ standupId: string; date: string }> {
    const context = await this.getSubmissionContext(submissionId);
    await this.standupsService.assertTeamMember(context.teamId, userId);

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
}
