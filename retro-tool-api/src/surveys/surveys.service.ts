import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, inArray, or } from 'drizzle-orm';
import * as surveysSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { EmailService } from '../email/email.service';
import { CreateSurveyDto, RespondSurveyDto, UpdateSurveyDto } from './dtos';
import {
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
  USER_STATUSES,
  type TSurveyQuestionType,
  type TSurveyScope,
} from '../common/enums';
import type { Survey, SurveyQuestion } from './schema';
import type {
  SurveyAnswerView,
  SurveyDetail,
  SurveyQuestionResults,
  SurveyRespondentView,
  SurveySummary,
} from './types';

type Database = NodePgDatabase<
  typeof surveysSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

@Injectable()
export class SurveysService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
  ) {}

  // ==========================================================================
  // Access helpers
  // ==========================================================================

  private async getUserContext(userId: string): Promise<{
    role: string;
    teamIds: string[];
    orgAdminIds: string[];
    orgIds: string[];
    leadTeamIds: string[];
    /** Parent org id for each team the user belongs to (teamId → orgId). */
    orgIdByTeamId: Record<string, string>;
  }> {
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

  private static isSystemAdmin(role: string): boolean {
    return role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin;
  }

  /**
   * Close / delete permission (scope-dependent):
   * - Team:   creator, team lead, org owner/admin of the team's org, sys/super admin
   * - Org:    creator, org owner/admin of that org, sys/super admin
   * - System: sys/super admin only
   */
  private canManage(
    record: Survey,
    userId: string,
    ctx: Awaited<ReturnType<SurveysService['getUserContext']>>,
  ): boolean {
    if (SurveysService.isSystemAdmin(ctx.role)) return true;
    if (record.scope === SURVEY_SCOPES.System) return false;

    if (record.createdById === userId) return true;

    if (record.scope === SURVEY_SCOPES.Team && record.teamId) {
      if (ctx.leadTeamIds.includes(record.teamId)) return true;
      const parentOrgId = ctx.orgIdByTeamId[record.teamId];
      return parentOrgId ? ctx.orgAdminIds.includes(parentOrgId) : false;
    }
    if (record.scope === SURVEY_SCOPES.Org && record.organizationId) {
      return ctx.orgAdminIds.includes(record.organizationId);
    }
    return false;
  }

  /**
   * Edit permission (title/description/questions): the creator, or a
   * system/super admin — at every scope. System-wide surveys are editable
   * only by system/super admins (they are also the only possible creators).
   */
  private canEdit(
    record: Survey,
    userId: string,
    ctx: Awaited<ReturnType<SurveysService['getUserContext']>>,
  ): boolean {
    if (SurveysService.isSystemAdmin(ctx.role)) return true;
    if (record.scope === SURVEY_SCOPES.System) return false;
    return record.createdById === userId;
  }

  private canSee(
    record: Survey,
    ctx: Awaited<ReturnType<SurveysService['getUserContext']>>,
  ): boolean {
    if (record.scope === SURVEY_SCOPES.System) return true;
    if (record.scope === SURVEY_SCOPES.Team && record.teamId) {
      return ctx.teamIds.includes(record.teamId);
    }
    if (record.scope === SURVEY_SCOPES.Org && record.organizationId) {
      return ctx.orgIds.includes(record.organizationId);
    }
    return false;
  }

  private static scopeLabel(record: Survey): string {
    if (record.scope === SURVEY_SCOPES.System) return 'Everyone';
    return record.scope === SURVEY_SCOPES.Org ? 'Organization' : 'Team';
  }

  private static parseOptions(question: SurveyQuestion): string[] {
    if (!question.options) return [];
    try {
      const parsed = JSON.parse(question.options) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
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

  private async toSummaries(
    userId: string,
    ctx: Awaited<ReturnType<SurveysService['getUserContext']>>,
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
      scopeLabel: SurveysService.scopeLabel(record),
      canManage: this.canManage(record, userId, ctx),
      canEdit: this.canEdit(record, userId, ctx),
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
    if (!this.canSee(record, ctx)) {
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
      options: SurveysService.parseOptions(question),
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

  private async buildResults(
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
      const options = SurveysService.parseOptions(question);

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

    const ctx = await this.getUserContext(userId);
    if (!this.canManage(record, userId, ctx)) {
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

    const results = await this.buildResults(surveyId, questionRows);
    const [summary] = await this.toSummaries(userId, ctx, [record]);

    const html = this.emailService.buildSurveyResultsHtml({
      surveyTitle: record.title,
      scopeLabel: SurveysService.scopeLabel(record),
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

  // ==========================================================================
  // Mutations
  // ==========================================================================

  async createSurvey(
    userId: string,
    data: CreateSurveyDto,
  ): Promise<{ id: string }> {
    const ctx = await this.getUserContext(userId);
    const scope = data.scope as TSurveyScope;

    if (scope === SURVEY_SCOPES.System) {
      if (!SurveysService.isSystemAdmin(ctx.role)) {
        throw new ForbiddenException(
          'Only system admins can create system-wide surveys',
        );
      }
    } else if (scope === SURVEY_SCOPES.Org) {
      if (
        !SurveysService.isSystemAdmin(ctx.role) &&
        !ctx.orgAdminIds.includes(data.organizationId!)
      ) {
        throw new ForbiddenException(
          'Only org owners/admins can create organization surveys',
        );
      }
    } else {
      if (
        !SurveysService.isSystemAdmin(ctx.role) &&
        !ctx.leadTeamIds.includes(data.teamId!)
      ) {
        throw new ForbiddenException('Only team leads can create team surveys');
      }
    }

    const id = generateId();

    await this.database.insert(surveysSchema.survey).values({
      id,
      title: data.title,
      description: data.description ?? null,
      scope,
      teamId: scope === SURVEY_SCOPES.Team ? (data.teamId ?? null) : null,
      organizationId:
        scope === SURVEY_SCOPES.Org ? (data.organizationId ?? null) : null,
      isAnonymous: data.isAnonymous,
      createdById: userId,
    });

    await this.database.insert(surveysSchema.surveyQuestion).values(
      data.questions.map((question, index) => ({
        id: generateId(),
        surveyId: id,
        type: question.type as TSurveyQuestionType,
        prompt: question.prompt,
        options:
          question.type === SURVEY_QUESTION_TYPES.Choice
            ? JSON.stringify(question.options)
            : null,
        order: index,
        isRequired: question.isRequired,
      })),
    );

    return { id };
  }

  /**
   * Edit a survey's title/description/anonymity and reconcile its questions.
   * Questions carrying an existing `id` are updated in place (their answers are
   * preserved); questions without an `id` are inserted; existing questions not
   * present in the payload are deleted (their answers cascade). Scope is
   * immutable. Permission: creator or system/super admin (see {@link canEdit}).
   */
  async updateSurvey(
    userId: string,
    surveyId: string,
    data: UpdateSurveyDto,
  ): Promise<{ success: boolean }> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.getUserContext(userId);
    if (!this.canEdit(record, userId, ctx)) {
      throw new ForbiddenException('You cannot edit this survey');
    }

    // Scalar fields.
    await this.database
      .update(surveysSchema.survey)
      .set({
        title: data.title,
        description: data.description ?? null,
        ...(data.isAnonymous !== undefined
          ? { isAnonymous: data.isAnonymous }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(surveysSchema.survey.id, surveyId));

    // Reconcile questions so answers on kept questions survive.
    const existing = await this.database
      .select({ id: surveysSchema.surveyQuestion.id })
      .from(surveysSchema.surveyQuestion)
      .where(eq(surveysSchema.surveyQuestion.surveyId, surveyId));
    const existingIds = new Set(existing.map((row) => row.id));

    const keptIds = new Set(
      data.questions
        .map((question) => question.id)
        .filter((id): id is string => Boolean(id) && existingIds.has(id!)),
    );

    const removedIds = existing
      .map((row) => row.id)
      .filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      await this.database
        .delete(surveysSchema.surveyQuestion)
        .where(inArray(surveysSchema.surveyQuestion.id, removedIds));
    }

    for (const [index, question] of data.questions.entries()) {
      const options =
        question.type === SURVEY_QUESTION_TYPES.Choice
          ? JSON.stringify(question.options ?? [])
          : null;

      if (question.id && existingIds.has(question.id)) {
        await this.database
          .update(surveysSchema.surveyQuestion)
          .set({
            type: question.type as TSurveyQuestionType,
            prompt: question.prompt,
            options,
            order: index,
            isRequired: question.isRequired,
          })
          .where(eq(surveysSchema.surveyQuestion.id, question.id));
      } else {
        await this.database.insert(surveysSchema.surveyQuestion).values({
          id: generateId(),
          surveyId,
          type: question.type as TSurveyQuestionType,
          prompt: question.prompt,
          options,
          order: index,
          isRequired: question.isRequired,
        });
      }
    }

    return { success: true };
  }

  async respond(
    userId: string,
    surveyId: string,
    data: RespondSurveyDto,
  ): Promise<{ success: boolean }> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.getUserContext(userId);
    if (!this.canSee(record, ctx)) {
      throw new ForbiddenException('You cannot access this survey');
    }
    if (record.isClosed) {
      throw new BadRequestException('This survey is closed');
    }

    const questionRows = await this.database
      .select()
      .from(surveysSchema.surveyQuestion)
      .where(eq(surveysSchema.surveyQuestion.surveyId, surveyId));

    const byId = new Map(
      questionRows.map((question) => [question.id, question]),
    );

    const isAnswered = (answer: RespondSurveyDto['answers'][number]) =>
      Boolean(
        answer.textValue?.trim() ||
        answer.ratingValue !== undefined ||
        answer.choiceValue,
      );

    for (const answer of data.answers) {
      const question = byId.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          'Answer references a question that does not belong to this survey',
        );
      }
      if (
        question.type === SURVEY_QUESTION_TYPES.Choice &&
        answer.choiceValue &&
        !SurveysService.parseOptions(question).includes(answer.choiceValue)
      ) {
        throw new BadRequestException('Invalid option selected');
      }
    }

    const answeredIds = new Set(
      data.answers.filter(isAnswered).map((answer) => answer.questionId),
    );
    const missing = questionRows.find(
      (question) => question.isRequired && !answeredIds.has(question.id),
    );
    if (missing) {
      throw new BadRequestException(`"${missing.prompt}" requires an answer`);
    }

    const answersToInsert = data.answers.filter(isAnswered);

    // Upsert: a user may edit their response while the survey is open. Reuse the
    // existing response row (preserving its id and createdAt) and replace its
    // answers atomically, so a failure can never leave a response with none.
    await this.database.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: surveysSchema.surveyResponse.id })
        .from(surveysSchema.surveyResponse)
        .where(
          and(
            eq(surveysSchema.surveyResponse.surveyId, surveyId),
            eq(surveysSchema.surveyResponse.userId, userId),
          ),
        )
        .limit(1);

      let responseId: string;
      if (existing) {
        responseId = existing.id;
        await tx
          .delete(surveysSchema.surveyAnswer)
          .where(eq(surveysSchema.surveyAnswer.responseId, responseId));
      } else {
        responseId = generateId();
        await tx.insert(surveysSchema.surveyResponse).values({
          id: responseId,
          surveyId,
          userId,
        });
      }

      if (answersToInsert.length > 0) {
        await tx.insert(surveysSchema.surveyAnswer).values(
          answersToInsert.map((answer) => ({
            id: generateId(),
            responseId,
            questionId: answer.questionId,
            textValue: answer.textValue?.trim() || null,
            ratingValue: answer.ratingValue ?? null,
            choiceValue: answer.choiceValue ?? null,
          })),
        );
      }
    });

    return { success: true };
  }

  async setClosed(
    userId: string,
    surveyId: string,
    isClosed: boolean,
  ): Promise<{ success: boolean }> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.getUserContext(userId);
    if (!this.canManage(record, userId, ctx)) {
      throw new ForbiddenException('You cannot manage this survey');
    }

    await this.database
      .update(surveysSchema.survey)
      .set({ isClosed, updatedAt: new Date() })
      .where(eq(surveysSchema.survey.id, surveyId));

    return { success: true };
  }

  async deleteSurvey(
    userId: string,
    surveyId: string,
  ): Promise<{ success: boolean }> {
    const [record] = await this.database
      .select()
      .from(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId))
      .limit(1);
    if (!record) throw new NotFoundException('Survey not found');

    const ctx = await this.getUserContext(userId);
    if (!this.canManage(record, userId, ctx)) {
      throw new ForbiddenException('You cannot manage this survey');
    }

    await this.database
      .delete(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId));

    return { success: true };
  }
}
