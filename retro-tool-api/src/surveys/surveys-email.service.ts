import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, asc } from 'drizzle-orm';
import * as surveysSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { EmailService } from '../email/email.service';
import { EMAIL_LOG_TYPES, SURVEY_SCOPES, USER_STATUSES } from '../common/enums';
import type { Survey } from './schema';
import { SurveysQueryService } from './surveys-query.service';
import { canManage, scopeLabel } from './surveys.utils';

type Database = NodePgDatabase<
  typeof surveysSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

/**
 * Distributes survey results by email. Split out of SurveysService so the
 * audience-resolution + delivery concern (which reads aggregated results via
 * the query service) lives apart from the survey write path.
 */
@Injectable()
export class SurveysEmailService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
    private readonly queryService: SurveysQueryService,
  ) {}

  /**
   * The set of email addresses a survey's results may be sent to, scoped to its
   * audience: team members for team surveys, org members for org surveys, and
   * all approved users for system ("Everyone") surveys. Returns `{email,name}`.
   */
  private async resolveAudience(
    record: Survey,
  ): Promise<{ email: string; name: string }[]> {
    if (record.scope === SURVEY_SCOPES.System) {
      return this.database
        .select({ email: authSchema.user.email, name: authSchema.user.name })
        .from(authSchema.user)
        .where(eq(authSchema.user.status, USER_STATUSES.Approved));
    }

    if (record.scope === SURVEY_SCOPES.Org && record.organizationId) {
      return this.database
        .select({ email: authSchema.user.email, name: authSchema.user.name })
        .from(orgSchema.organizationMember)
        .innerJoin(
          authSchema.user,
          eq(authSchema.user.id, orgSchema.organizationMember.userId),
        )
        .where(
          eq(
            orgSchema.organizationMember.organizationId,
            record.organizationId,
          ),
        );
    }

    if (record.scope === SURVEY_SCOPES.Team && record.teamId) {
      return this.database
        .select({ email: authSchema.user.email, name: authSchema.user.name })
        .from(teamSchema.teamMember)
        .innerJoin(
          authSchema.user,
          eq(authSchema.user.id, teamSchema.teamMember.userId),
        )
        .where(eq(teamSchema.teamMember.teamId, record.teamId));
    }

    return [];
  }

  /**
   * Email the survey results to its audience. Only a manager may send. When
   * `recipients` is provided the list is restricted to the survey's audience
   * (so a system survey can be sent to a hand-picked subset, but an org/team
   * survey can never leak outside its members); when omitted, the whole
   * audience receives it.
   */
  async emailResults(
    userId: string,
    surveyId: string,
    recipients?: string[],
  ): Promise<{ sent: number }> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.queryService.getUserContext(userId);
    if (!canManage(record, userId, ctx)) {
      throw new ForbiddenException('You cannot email results for this survey');
    }

    const audience = await this.resolveAudience(record);
    const allowed = new Map(
      audience.map((member) => [member.email.toLowerCase(), member]),
    );

    let targets: { email: string; name: string }[];
    if (recipients && recipients.length > 0) {
      // Keep only addresses inside the survey's audience — never email outside
      // the team/org/system scope, even if the client asks.
      targets = recipients
        .map((email) => allowed.get(email.toLowerCase()))
        .filter((member): member is { email: string; name: string } =>
          Boolean(member),
        );
    } else {
      targets = audience;
    }

    if (targets.length === 0) {
      throw new BadRequestException('No valid recipients for this survey');
    }

    const questionRows = await this.database
      .select()
      .from(surveysSchema.surveyQuestion)
      .where(eq(surveysSchema.surveyQuestion.surveyId, surveyId))
      .orderBy(asc(surveysSchema.surveyQuestion.order));

    const results = await this.queryService.buildResults(
      surveyId,
      questionRows,
    );
    const [summary] = await this.queryService.toSummaries(userId, ctx, [
      record,
    ]);

    const html = this.emailService.buildSurveyResultsHtml({
      surveyTitle: record.title,
      scopeLabel: scopeLabel(record),
      isAnonymous: record.isAnonymous,
      responseCount: summary.responseCount,
      questions: results.map((result) => ({
        prompt: result.prompt,
        type: result.type,
        answerCount: result.answerCount,
        averageRating: result.averageRating,
        optionCounts: result.optionCounts,
        textAnswers: result.textAnswers,
      })),
    });

    let sent = 0;
    for (const target of targets) {
      const ok = await this.emailService.send({
        to: target.email,
        subject: `Survey Results: ${record.title}`,
        html,
        userId,
        type: EMAIL_LOG_TYPES.SurveyResults,
      });
      if (ok) sent++;
    }

    return { sent };
  }
}
