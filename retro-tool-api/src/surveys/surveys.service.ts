import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import * as surveysSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { CreateSurveyDto, RespondSurveyDto, UpdateSurveyDto } from './dtos';
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  type TSurveyQuestionType,
  type TSurveyScope,
} from '../common/enums';
import { SurveysQueryService } from './surveys-query.service';
import {
  canEdit,
  canManage,
  canSee,
  isSystemAdmin,
  parseOptions,
} from './surveys.utils';

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
    private readonly queryService: SurveysQueryService,
  ) {}

  // ==========================================================================
  // Mutations
  // ==========================================================================

  async createSurvey(
    userId: string,
    data: CreateSurveyDto,
  ): Promise<{ id: string }> {
    const ctx = await this.queryService.getUserContext(userId);
    const scope = data.scope as TSurveyScope;

    if (scope === SURVEY_SCOPES.System) {
      if (!isSystemAdmin(ctx.role)) {
        throw new ForbiddenException(
          'Only system admins can create system-wide surveys',
        );
      }
    } else if (scope === SURVEY_SCOPES.Org) {
      if (
        !isSystemAdmin(ctx.role) &&
        !ctx.orgAdminIds.includes(data.organizationId!)
      ) {
        throw new ForbiddenException(
          'Only org owners/admins can create organization surveys',
        );
      }
    } else {
      if (!isSystemAdmin(ctx.role) && !ctx.leadTeamIds.includes(data.teamId!)) {
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

    const ctx = await this.queryService.getUserContext(userId);
    if (!canEdit(record, userId, ctx)) {
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

    const ctx = await this.queryService.getUserContext(userId);
    if (!canSee(record, ctx)) {
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
        !parseOptions(question).includes(answer.choiceValue)
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

    const ctx = await this.queryService.getUserContext(userId);
    if (!canManage(record, userId, ctx)) {
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

    const ctx = await this.queryService.getUserContext(userId);
    if (!canManage(record, userId, ctx)) {
      throw new ForbiddenException('You cannot manage this survey');
    }

    await this.database
      .delete(surveysSchema.survey)
      .where(eq(surveysSchema.survey.id, surveyId));

    return { success: true };
  }
}
