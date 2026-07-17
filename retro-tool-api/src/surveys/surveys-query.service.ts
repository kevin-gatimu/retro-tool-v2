import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, inArray, or } from 'drizzle-orm';
import * as surveysSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import {
  ORG_MEMBER_ROLES,
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from '../common/enums';
import type { Survey, SurveyQuestion } from './schema';
import type {
  SurveyAnswerView,
  SurveyDetail,
  SurveyQuestionResults,
  SurveyRespondentView,
  SurveySummary,
  SurveyUserContext,
} from './types';
import {
  canEdit,
  canManage,
  canSee,
  parseOptions,
  scopeLabel,
} from './surveys.utils';

type Database = NodePgDatabase<
  typeof surveysSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

/**
 * Read side of the surveys module: user-context resolution, list/detail
 * queries, and results/respondent aggregation. Split out of SurveysService so
 * the aggregation maths and per-viewer authorization live apart from the
 * mutation + email logic. PostgreSQL remains the source of truth.
 */
@Injectable()
export class SurveysQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  // ==========================================================================
  // Access helpers
  // ==========================================================================

  async getUserContext(userId: string): Promise<SurveyUserContext> {
    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const teamMemberships = await this.database
      .select({
        teamId: teamSchema.teamMember.teamId,
        tag: teamSchema.teamMember.tag,
        orgId: teamSchema.team.organizationId,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.team.id, teamSchema.teamMember.teamId),
      )
      .where(eq(teamSchema.teamMember.userId, userId));

    const orgMemberships = await this.database
      .select({
        orgId: orgSchema.organizationMember.organizationId,
        role: orgSchema.organizationMember.role,
      })
      .from(orgSchema.organizationMember)
      .where(eq(orgSchema.organizationMember.userId, userId));

    const orgIdByTeamId: Record<string, string> = {};
    for (const membership of teamMemberships) {
      orgIdByTeamId[membership.teamId] = membership.orgId;
    }

    return {
      role: fullUser?.role ?? USER_ROLES.Member,
      teamIds: teamMemberships.map((m) => m.teamId),
      leadTeamIds: teamMemberships
        .filter((m) => m.tag === TEAM_MEMBER_TAGS.Lead)
        .map((m) => m.teamId),
      orgIds: orgMemberships.map((m) => m.orgId),
      orgAdminIds: orgMemberships
        .filter(
          (m) =>
            m.role === ORG_MEMBER_ROLES.Owner ||
            m.role === ORG_MEMBER_ROLES.Admin,
        )
        .map((m) => m.orgId),
      orgIdByTeamId,
    };
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  async getSurveys(userId: string): Promise<SurveySummary[]> {
    const ctx = await this.getUserContext(userId);

    const conditions = [eq(surveysSchema.survey.scope, SURVEY_SCOPES.System)];
    if (ctx.teamIds.length > 0) {
      conditions.push(inArray(surveysSchema.survey.teamId, ctx.teamIds));
    }
    if (ctx.orgIds.length > 0) {
      conditions.push(inArray(surveysSchema.survey.organizationId, ctx.orgIds));
    }

    const surveys = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(or(...conditions))
      .orderBy(desc(surveysSchema.survey.createdAt));

    if (surveys.length === 0) return [];

    return this.toSummaries(userId, ctx, surveys);
  }

  /** Count of open surveys the user can see but hasn't answered (nav badge). */
  async getActiveCount(userId: string): Promise<{ count: number }> {
    const summaries = await this.getSurveys(userId);
    return {
      count: summaries.filter(
        (survey) => !survey.isClosed && !survey.hasResponded,
      ).length,
    };
  }

  async toSummaries(
    userId: string,
    ctx: SurveyUserContext,
    surveys: Survey[],
  ): Promise<SurveySummary[]> {
    const surveyIds = surveys.map((record) => record.id);
    const creatorIds = [
      ...new Set(
        surveys
          .map((record) => record.createdById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [responses, creators, questions] = await Promise.all([
      this.database
        .select({
          surveyId: surveysSchema.surveyResponse.surveyId,
          userId: surveysSchema.surveyResponse.userId,
        })
        .from(surveysSchema.surveyResponse)
        .where(inArray(surveysSchema.surveyResponse.surveyId, surveyIds)),
      creatorIds.length > 0
        ? this.database
            .select({ id: authSchema.user.id, name: authSchema.user.name })
            .from(authSchema.user)
            .where(inArray(authSchema.user.id, creatorIds))
        : Promise.resolve([]),
      this.database
        .select({
          id: surveysSchema.surveyQuestion.id,
          surveyId: surveysSchema.surveyQuestion.surveyId,
        })
        .from(surveysSchema.surveyQuestion)
        .where(inArray(surveysSchema.surveyQuestion.surveyId, surveyIds)),
    ]);

    return surveys.map((record) => ({
      ...record,
      scopeLabel: scopeLabel(record),
      canManage: canManage(record, userId, ctx),
      canEdit: canEdit(record, userId, ctx),
      hasResponded: responses.some(
        (response) =>
          response.surveyId === record.id && response.userId === userId,
      ),
      responseCount: responses.filter(
        (response) => response.surveyId === record.id,
      ).length,
      audienceCount: 0,
      questionCount: questions.filter(
        (question) => question.surveyId === record.id,
      ).length,
      createdBy:
        creators.find((creator) => creator.id === record.createdById) ?? null,
    }));
  }

  async getSurvey(userId: string, surveyId: string): Promise<SurveyDetail> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.getUserContext(userId);
    if (!canSee(record, ctx)) {
      throw new ForbiddenException('You cannot access this survey');
    }

    const [summary] = await this.toSummaries(userId, ctx, [record]);

    const questionRows = await this.database
      .select()
      .from(surveysSchema.surveyQuestion)
      .where(eq(surveysSchema.surveyQuestion.surveyId, surveyId))
      .orderBy(asc(surveysSchema.surveyQuestion.order));

    const questions = questionRows.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: parseOptions(question),
      order: question.order,
      isRequired: question.isRequired,
    }));

    // Results are visible to managers, or to anyone once they've responded
    // (or after the survey closes).
    const canSeeResults =
      summary.canManage || summary.hasResponded || record.isClosed;

    const results = canSeeResults
      ? await this.buildResults(surveyId, questionRows)
      : null;

    // Per-respondent submissions:
    // - Non-anonymous: shown to everyone who can see results, with names.
    // - Anonymous: shown to managers only (creator/admins), with identity
    //   stripped — each respondent surfaces as "Anonymous" and no real userId
    //   leaves the server, so answers can't be tied back to a person.
    // Other viewers of an anonymous survey get respondents: null (aggregate only).
    const canSeeRespondents = record.isAnonymous
      ? summary.canManage
      : canSeeResults;
    const respondents = canSeeRespondents
      ? await this.buildRespondents(surveyId, {
          includeIdentity: !record.isAnonymous,
        })
      : null;

    // The caller's own answers, for pre-filling the edit form. Scoped strictly
    // to this user — never expose one user's answers to another, so this stays
    // safe even for anonymous surveys.
    const myAnswers = summary.hasResponded
      ? await this.getUserAnswers(surveyId, userId)
      : null;

    return { ...summary, questions, results, respondents, myAnswers };
  }

  /** The requesting user's own answers for a survey (edit-form pre-fill). */
  private async getUserAnswers(
    surveyId: string,
    userId: string,
  ): Promise<SurveyAnswerView[]> {
    const [response] = await this.database
      .select({ id: surveysSchema.surveyResponse.id })
      .from(surveysSchema.surveyResponse)
      .where(
        and(
          eq(surveysSchema.surveyResponse.surveyId, surveyId),
          eq(surveysSchema.surveyResponse.userId, userId),
        ),
      )
      .limit(1);
    if (!response) return [];

    const answers = await this.database
      .select({
        questionId: surveysSchema.surveyAnswer.questionId,
        textValue: surveysSchema.surveyAnswer.textValue,
        ratingValue: surveysSchema.surveyAnswer.ratingValue,
        choiceValue: surveysSchema.surveyAnswer.choiceValue,
      })
      .from(surveysSchema.surveyAnswer)
      .where(eq(surveysSchema.surveyAnswer.responseId, response.id));

    return answers;
  }

  async buildResults(
    surveyId: string,
    questionRows: SurveyQuestion[],
  ): Promise<SurveyQuestionResults[]> {
    const responses = await this.database
      .select({ id: surveysSchema.surveyResponse.id })
      .from(surveysSchema.surveyResponse)
      .where(eq(surveysSchema.surveyResponse.surveyId, surveyId));

    const responseIds = responses.map((response) => response.id);
    const answers =
      responseIds.length > 0
        ? await this.database
            .select()
            .from(surveysSchema.surveyAnswer)
            .where(inArray(surveysSchema.surveyAnswer.responseId, responseIds))
        : [];

    return questionRows.map((question) => {
      const questionAnswers = answers.filter(
        (answer) => answer.questionId === question.id,
      );
      const options = parseOptions(question);

      let optionCounts: { label: string; count: number }[] = [];
      let averageRating: number | null = null;
      let textAnswers: string[] = [];

      if (question.type === SURVEY_QUESTION_TYPES.Choice) {
        optionCounts = options.map((label) => ({
          label,
          count: questionAnswers.filter(
            (answer) => answer.choiceValue === label,
          ).length,
        }));
      } else if (question.type === SURVEY_QUESTION_TYPES.Rating) {
        const ratings = questionAnswers
          .map((answer) => answer.ratingValue)
          .filter((value): value is number => value !== null);
        optionCounts = [1, 2, 3, 4, 5].map((rating) => ({
          label: String(rating),
          count: ratings.filter((value) => value === rating).length,
        }));
        averageRating =
          ratings.length > 0
            ? Math.round(
                (ratings.reduce((sum, value) => sum + value, 0) /
                  ratings.length) *
                  10,
              ) / 10
            : null;
      } else {
        textAnswers = questionAnswers
          .map((answer) => answer.textValue)
          .filter((value): value is string => Boolean(value?.trim()));
      }

      return {
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        optionCounts,
        averageRating,
        textAnswers,
        answerCount: questionAnswers.length,
      };
    });
  }

  /**
   * Per-respondent submissions: each responder's answers grouped together.
   * With `includeIdentity: true` (non-anonymous surveys) the responder's real
   * userId/name/image are attached. With `includeIdentity: false` (anonymous
   * surveys, managers-only) identity is stripped server-side — name/image are
   * null and the real userId is replaced with a synthetic per-response key — so
   * answers can be perused but never tied back to a person.
   */
  private async buildRespondents(
    surveyId: string,
    { includeIdentity }: { includeIdentity: boolean },
  ): Promise<SurveyRespondentView[]> {
    const responses = await this.database
      .select({
        responseId: surveysSchema.surveyResponse.id,
        userId: surveysSchema.surveyResponse.userId,
        name: authSchema.user.name,
        image: authSchema.user.image,
      })
      .from(surveysSchema.surveyResponse)
      .innerJoin(
        authSchema.user,
        eq(surveysSchema.surveyResponse.userId, authSchema.user.id),
      )
      .where(eq(surveysSchema.surveyResponse.surveyId, surveyId))
      .orderBy(asc(surveysSchema.surveyResponse.createdAt));

    const responseIds = responses.map((response) => response.responseId);
    if (responseIds.length === 0) return [];

    const answers = await this.database
      .select({
        responseId: surveysSchema.surveyAnswer.responseId,
        questionId: surveysSchema.surveyAnswer.questionId,
        textValue: surveysSchema.surveyAnswer.textValue,
        ratingValue: surveysSchema.surveyAnswer.ratingValue,
        choiceValue: surveysSchema.surveyAnswer.choiceValue,
      })
      .from(surveysSchema.surveyAnswer)
      .where(inArray(surveysSchema.surveyAnswer.responseId, responseIds));

    return responses.map((response, order) => ({
      // For anonymous surveys strip identity server-side so the response is the
      // same for any API consumer: no real userId leaves the server (a stable
      // synthetic key keeps React lists happy), name is the literal "Anonymous",
      // and image is null.
      userId: includeIdentity ? response.userId : `anon-${order}`,
      name: includeIdentity ? response.name : 'Anonymous',
      image: includeIdentity ? response.image : null,
      answers: answers
        .filter((answer) => answer.responseId === response.responseId)
        .map((answer) => ({
          questionId: answer.questionId,
          textValue: answer.textValue,
          ratingValue: answer.ratingValue,
          choiceValue: answer.choiceValue,
        })),
    }));
  }
}
