import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, type SQL } from 'drizzle-orm';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as standupsSchema from '../standups/schema';
import { generateId } from '../lib/utils';
import { generateSeed, seededShuffle } from '../lib/seeded-random';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIcebreakerSessionDto } from './dtos';
import {
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_PROMPT_DECISIONS,
  ICEBREAKER_SELECTION_MODES,
  type TIcebreakerFlavour,
} from '../common/enums';

const MAX_DECK_SIZE = 20;

type Database = NodePgDatabase<
  typeof icebreakersSchema & typeof teamSchema & typeof standupsSchema
>;

/**
 * Session creation + deck materialisation. Split out of IcebreakersService
 * (which was ~1,050 lines) since building a new session's deck (candidate
 * collection, seeded shuffle, custom-prompt handling) is a self-contained
 * write concern, distinct from the deck-curation lifecycle that stays in
 * IcebreakersService.
 */
@Injectable()
export class IcebreakersCreationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSession(
    userId: string,
    data: CreateIcebreakerSessionDto,
  ): Promise<{ id: string }> {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, data.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Access denied');

    // When attaching to a standup day both parts are required, and the standup
    // must belong to the same team (mirrors poll → standup attachment).
    const standupId = data.standupId ?? null;
    let entryDate = data.entryDate ?? null;
    if (standupId) {
      if (!entryDate) {
        throw new BadRequestException(
          'entryDate is required when attaching a session to a standup',
        );
      }
      const [standupRecord] = await this.database
        .select({ teamId: standupsSchema.standup.teamId })
        .from(standupsSchema.standup)
        .where(eq(standupsSchema.standup.id, standupId))
        .limit(1);
      if (!standupRecord) {
        throw new NotFoundException('Standup not found');
      }
      if (standupRecord.teamId !== data.teamId) {
        throw new BadRequestException(
          'Session team must match the standup team',
        );
      }
    } else {
      entryDate = null;
    }

    const id = generateId();
    const now = new Date();
    const seed = generateSeed();
    const customPrompts = data.customPrompts ?? null;
    const isCustom =
      data.selectionMode === ICEBREAKER_SELECTION_MODES.Custom ||
      (customPrompts !== null && customPrompts.length > 0);
    const selectionMode = isCustom
      ? ICEBREAKER_SELECTION_MODES.Custom
      : (data.selectionMode ?? ICEBREAKER_SELECTION_MODES.Ordered);
    // Custom sessions carry no template and never flavour-filter.
    const templateId = isCustom ? null : (data.templateId ?? null);
    const flavourFilter = isCustom ? null : (data.flavourFilter ?? null);

    // Build the seed-ordered deck up front so the session opens straight into
    // the Curating phase — no separate "start" step. Custom decks use the
    // host-authored prompts verbatim (in order, no shuffle, no template link).
    let deck: { promptId: string | null; text: string }[];
    if (isCustom) {
      if (!customPrompts || customPrompts.length === 0) {
        throw new BadRequestException(
          'At least one prompt is required for a custom icebreaker',
        );
      }
      deck = customPrompts
        .slice(0, MAX_DECK_SIZE)
        .map((prompt) => ({ promptId: null, text: prompt.text }));
    } else {
      const candidates = await this.collectDeckCandidates({
        templateId,
        flavourFilter,
      });

      if (candidates.length === 0) {
        throw new BadRequestException(
          'No prompts available to build the icebreaker deck',
        );
      }

      const isRandom =
        selectionMode === ICEBREAKER_SELECTION_MODES.Random || !templateId;
      const ordered = isRandom ? seededShuffle(candidates, seed) : candidates;
      deck = ordered.slice(0, MAX_DECK_SIZE);
    }

    await this.database.insert(icebreakersSchema.icebreakerSession).values({
      id,
      name: data.name,
      teamId: data.teamId,
      createdById: userId,
      status: ICEBREAKER_SESSION_STATUSES.Curating,
      templateId,
      standupId,
      entryDate,
      selectionMode,
      seed,
      flavourFilter,
      timerDuration: data.timerDuration,
      createdAt: now,
      updatedAt: now,
    });

    await this.database
      .insert(icebreakersSchema.icebreakerSessionPrompt)
      .values(
        deck.map((candidate, index) => ({
          id: generateId(),
          sessionId: id,
          promptId: candidate.promptId,
          text: candidate.text,
          deckOrder: index,
          decision: ICEBREAKER_PROMPT_DECISIONS.Pending,
        })),
      );

    void this.notificationsService
      .notifyTeamOfIcebreakerSession(id, data.name, data.teamId)
      .catch(() => undefined);

    return { id };
  }

  private async collectDeckCandidates(source: {
    templateId: string | null;
    flavourFilter: string | null;
  }): Promise<{ promptId: string; text: string }[]> {
    if (source.templateId) {
      const prompts = await this.database
        .select({
          id: icebreakersSchema.icebreakerPrompt.id,
          text: icebreakersSchema.icebreakerPrompt.text,
        })
        .from(icebreakersSchema.icebreakerPrompt)
        .where(
          eq(icebreakersSchema.icebreakerPrompt.templateId, source.templateId),
        )
        .orderBy(asc(icebreakersSchema.icebreakerPrompt.order));

      return prompts.map((p) => ({ promptId: p.id, text: p.text }));
    }

    // No template → random across built-in prompts, optionally filtered by
    // flavour. The seeded shuffle at create time makes the pick reproducible.
    const conditions: SQL[] = [
      eq(icebreakersSchema.icebreakerTemplate.isBuiltIn, true),
    ];
    if (source.flavourFilter) {
      conditions.push(
        eq(
          icebreakersSchema.icebreakerTemplate.flavour,
          source.flavourFilter as TIcebreakerFlavour,
        ),
      );
    }

    const prompts = await this.database
      .select({
        id: icebreakersSchema.icebreakerPrompt.id,
        text: icebreakersSchema.icebreakerPrompt.text,
      })
      .from(icebreakersSchema.icebreakerPrompt)
      .innerJoin(
        icebreakersSchema.icebreakerTemplate,
        eq(
          icebreakersSchema.icebreakerPrompt.templateId,
          icebreakersSchema.icebreakerTemplate.id,
        ),
      )
      .where(and(...conditions));

    return prompts.map((p) => ({ promptId: p.id, text: p.text }));
  }
}
