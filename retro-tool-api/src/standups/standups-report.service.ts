import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import { EmailService } from '../email/email.service';
import { SendStandupReportDto } from './dtos';
import { EMAIL_LOG_TYPES } from '../common/enums';
import { StandupsService } from './standups.service';
import { StandupsEntriesService } from './standups-entries.service';
import { formatReportDate } from './standups.utils';

type Database = NodePgDatabase<typeof teamSchema & typeof authSchema>;

/**
 * Standup day email reports. Split out of StandupsService so the report HTML
 * assembly + recipient resolution + send loop live apart from the standup
 * lifecycle; delegates record/access checks and entry assembly back to the
 * standups + entries services.
 */
@Injectable()
export class StandupsReportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly standupsService: StandupsService,
    private readonly standupsEntriesService: StandupsEntriesService,
    private readonly emailService: EmailService,
  ) {}

  async sendStandupReport(
    userId: string,
    standupId: string,
    data: SendStandupReportDto,
  ): Promise<{ sent: number }> {
    const record = await this.standupsService.getStandupRecord(standupId);
    await this.standupsService.assertTeamMember(record.teamId, userId);

    const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
    const entryDetail = await this.standupsEntriesService.getEntryDetail(
      userId,
      standupId,
      dateStr,
    );

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
      date: formatReportDate(dateStr),
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

    const subject = `Standup Report: ${entryDetail.standup.name} — ${formatReportDate(dateStr)}`;

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
}
