import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Config } from '../config/configuration';
import { EmailService } from '../email/email.service';
import {
  eq,
  ne,
  and,
  or,
  desc,
  inArray,
  count,
  ilike,
  lt,
  type SQL,
} from 'drizzle-orm';
import * as retroSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { ActionItem, CardComment } from './schema';
import {
  CreateRetroDto,
  CreateCardDto,
  UpdateCardDto,
  CreateCommentDto,
  SendRetroReportDto,
} from './dtos';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ACTION_ITEM_STATUSES,
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  RETRO_STATUSES,
  RETRO_VOTE_TYPES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from '../common/enums';
import type { TRetroVoteType } from '../common/enums';
import { generateId } from '../lib/utils';
import type {
  MergeMetadata,
  MergeSourceCardSnapshot,
  RetroDetailResponse,
} from './types';
import { MERGED_FROM_LINE_REGEX, MERGE_METADATA_REGEX } from '../common/regex';

type Database = NodePgDatabase<
  typeof retroSchema & typeof teamSchema & typeof authSchema & typeof orgSchema
>;

const parseMergeMetadata = (content: string): MergeMetadata | null => {
  const metaMatch = content.match(MERGE_METADATA_REGEX);
  if (!metaMatch?.[1]) return null;

  try {
    const decoded = Buffer.from(metaMatch[1], 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as MergeMetadata;

    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.sourceCards) ||
      parsed.sourceCards.some(
        (card) =>
          typeof card?.authorId !== 'string' ||
          typeof card?.columnId !== 'string' ||
          typeof card?.content !== 'string',
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const removeMergeMetadata = (content: string): string =>
  content.replace(MERGE_METADATA_REGEX, '').replace(/\s+$/, '');

@Injectable()
export class RetrosService {
  private readonly logger = new Logger(RetrosService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
  ) {}

  private async invalidateRetroCache(
    retroId: string,
    options: { invalidateLists?: boolean } = {},
  ): Promise<void> {
    void retroId;
    void options;
    await Promise.resolve();
  }

  // ============================================================================
  // Template Methods — moved to RetrosTemplatesService (retros-templates.service.ts)
  // ============================================================================

  // ============================================================================
  // Retrospective Methods
  // ============================================================================

  async getRecentRetros(
    userId: string,
    page = 1,
    limit = 12,
    status?: 'ongoing' | 'completed',
    teamId?: string,
    search?: string,
  ): Promise<{
    retros: {
      id: string;
      name: string;
      status: string;
      createdAt: Date;
      teamId: string;
      teamName: string | null;
      teamEmoji: string | null;
      templateId: string;
      templateName: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [fullUser] = await this.database
      .select()
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (!fullUser) throw new NotFoundException('User not found');

    const conditions: SQL[] = [];

    if (
      fullUser.role !== USER_ROLES.SuperAdmin &&
      fullUser.role !== USER_ROLES.SystemAdmin
    ) {
      const memberships = await this.database
        .select({ teamId: teamSchema.teamMember.teamId })
        .from(teamSchema.teamMember)
        .where(eq(teamSchema.teamMember.userId, userId));

      const teamIds = memberships.map((m) => m.teamId);
      if (teamIds.length === 0) return { retros: [], total: 0, page, limit };
      conditions.push(inArray(retroSchema.retrospective.teamId, teamIds));
    }

    if (teamId) {
      conditions.push(eq(retroSchema.retrospective.teamId, teamId));
    }

    // 'completed' = the completed status; 'ongoing' = everything else (draft,
    // waiting, active, grouping, voting, discussing). Using ne() keeps "ongoing"
    // robust if new in-progress statuses are added. Undefined = no status filter
    // (preserves the dashboard's mixed-list behavior).
    if (status === 'completed') {
      conditions.push(eq(retroSchema.retrospective.status, 'completed'));
    } else if (status === 'ongoing') {
      conditions.push(ne(retroSchema.retrospective.status, 'completed'));
    }

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      conditions.push(
        or(
          ilike(retroSchema.retrospective.name, `%${normalizedSearch}%`),
          ilike(teamSchema.team.name, `%${normalizedSearch}%`),
        )!,
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Join team in the count too — the search predicate references team.name.
    const [totalRow] = await this.database
      .select({ total: count() })
      .from(retroSchema.retrospective)
      .leftJoin(
        teamSchema.team,
        eq(retroSchema.retrospective.teamId, teamSchema.team.id),
      )
      .where(whereClause);

    const retros = await this.database
      .select({
        id: retroSchema.retrospective.id,
        name: retroSchema.retrospective.name,
        status: retroSchema.retrospective.status,
        createdAt: retroSchema.retrospective.createdAt,
        teamId: retroSchema.retrospective.teamId,
        teamName: teamSchema.team.name,
        teamEmoji: teamSchema.team.emoji,
        templateId: retroSchema.retrospective.templateId,
        templateName: retroSchema.template.name,
      })
      .from(retroSchema.retrospective)
      .leftJoin(
        teamSchema.team,
        eq(retroSchema.retrospective.teamId, teamSchema.team.id),
      )
      .leftJoin(
        retroSchema.template,
        eq(retroSchema.retrospective.templateId, retroSchema.template.id),
      )
      .where(whereClause)
      .orderBy(desc(retroSchema.retrospective.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return { retros, total: totalRow?.total ?? 0, page, limit };
  }

  async createRetro(
    userId: string,
    data: CreateRetroDto,
  ): Promise<{ id: string }> {
    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, data.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You must be a team member to create a retrospective',
      );
    }

    const retroId = generateId();

    const voteType = (data.voteType ??
      RETRO_VOTE_TYPES.Multi) as TRetroVoteType;
    await this.database.insert(retroSchema.retrospective).values({
      id: retroId,
      name: data.name,
      teamId: data.teamId,
      templateId: data.templateId,
      isAnonymous: data.isAnonymous ?? true,
      maxVotesPerUser: data.maxVotesPerUser ?? 3,
      voteType,
      timerDuration: data.timerDuration ?? null,
      createdById: userId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    });

    await this.database.insert(retroSchema.retroParticipant).values({
      id: generateId(),
      retroId,
      userId,
    });

    // Notify other team members so they can join the newly created retro.
    void this.notificationsService
      .notifyTeamOfRetroCreated(retroId, data.name, data.teamId, userId)
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Retro-created notifications failed for retroId=${retroId}: ${message}`,
        );
      });

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { id: retroId };
  }

  /**
   * Whether the user belongs to the retro's team. The WebSocket `join-retro`
   * handler calls this before joining the room — handshake auth only proves
   * identity, not membership, so without this any authenticated socket could
   * join any retro by ID and receive its realtime board updates
   * (SECURITY-ASSESSMENT F2). Mirrors the membership gate in the REST getRetro path.
   */
  async isRetroMember(retroId: string, userId: string): Promise<boolean> {
    const [retro] = await this.database
      .select({ teamId: retroSchema.retrospective.teamId })
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) return false;

    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return Boolean(membership);
  }

  async getRetro(
    userId: string,
    retroId: string,
  ): Promise<RetroDetailResponse> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [team] = await this.database
      .select({
        id: teamSchema.team.id,
        name: teamSchema.team.name,
        organizationId: teamSchema.team.organizationId,
      })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, retro.teamId))
      .limit(1);

    const [template] = await this.database
      .select({
        id: retroSchema.template.id,
        name: retroSchema.template.name,
      })
      .from(retroSchema.template)
      .where(eq(retroSchema.template.id, retro.templateId))
      .limit(1);

    const templateColumns = await this.database
      .select()
      .from(retroSchema.templateColumn)
      .where(eq(retroSchema.templateColumn.templateId, retro.templateId))
      .orderBy(retroSchema.templateColumn.order);

    const rawParticipants = await this.database
      .select({
        id: retroSchema.retroParticipant.id,
        userId: retroSchema.retroParticipant.userId,
      })
      .from(retroSchema.retroParticipant)
      .where(eq(retroSchema.retroParticipant.retroId, retroId));

    const seenUserIds = new Set<string>();
    const participants = rawParticipants.filter((p) => {
      if (seenUserIds.has(p.userId)) return false;
      seenUserIds.add(p.userId);
      return true;
    });

    const teamMembers = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        roleName: teamSchema.teamRole.name,
        tag: teamSchema.teamMember.tag,
      })
      .from(teamSchema.teamMember)
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .where(eq(teamSchema.teamMember.teamId, retro.teamId));

    const cards = await this.database
      .select({
        id: retroSchema.card.id,
        columnId: retroSchema.card.columnId,
        content: retroSchema.card.content,
        authorId: retroSchema.card.authorId,
        createdAt: retroSchema.card.createdAt,
        updatedAt: retroSchema.card.updatedAt,
        isDiscussed: retroSchema.card.isDiscussed,
        discussedAt: retroSchema.card.discussedAt,
      })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.retroId, retroId))
      .orderBy(desc(retroSchema.card.createdAt));

    const cardIds = cards.map((card) => card.id);

    const votes =
      cardIds.length > 0
        ? await this.database
            .select({
              cardId: retroSchema.vote.cardId,
              userId: retroSchema.vote.userId,
            })
            .from(retroSchema.vote)
            .where(inArray(retroSchema.vote.cardId, cardIds))
        : [];

    const comments =
      cardIds.length > 0
        ? await this.database
            .select({
              id: retroSchema.cardComment.id,
              cardId: retroSchema.cardComment.cardId,
              authorId: retroSchema.cardComment.authorId,
              content: retroSchema.cardComment.content,
              createdAt: retroSchema.cardComment.createdAt,
              updatedAt: retroSchema.cardComment.updatedAt,
            })
            .from(retroSchema.cardComment)
            .where(inArray(retroSchema.cardComment.cardId, cardIds))
            .orderBy(retroSchema.cardComment.createdAt)
        : [];

    // Query for cards that have been carried forward
    const carriedForwardCardIds =
      cardIds.length > 0
        ? await this.database
            .select({ cardId: retroSchema.actionItem.cardId })
            .from(retroSchema.actionItem)
            .where(
              and(
                inArray(retroSchema.actionItem.cardId, cardIds),
                eq(retroSchema.actionItem.isCarriedForward, true),
              ),
            )
        : [];

    const carriedForwardCardIdSet = new Set(
      carriedForwardCardIds
        .map((item) => item.cardId)
        .filter((id): id is string => id !== null),
    );

    const authorIds = Array.from(
      new Set([
        ...cards.map((card) => card.authorId),
        ...comments.map((comment) => comment.authorId),
        ...participants.map((p) => p.userId),
      ]),
    ).filter((id): id is string => id !== null);

    const users =
      authorIds.length > 0
        ? await this.database
            .select({
              id: authSchema.user.id,
              name: authSchema.user.name,
              image: authSchema.user.image,
            })
            .from(authSchema.user)
            .where(inArray(authSchema.user.id, authorIds))
        : [];

    const [userRecord] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isSystemAdmin =
      userRecord?.role === USER_ROLES.SuperAdmin ||
      userRecord?.role === USER_ROLES.SystemAdmin;

    const membership =
      teamMembers.find((member) => member.userId === userId) ?? null;

    if (!isSystemAdmin && !membership) {
      throw new ForbiddenException(
        'You must be a team member to view this retrospective',
      );
    }

    const [orgMembership] = team?.organizationId
      ? await this.database
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
          .limit(1)
      : [undefined];

    const isOrgAdmin =
      orgMembership?.role === ORG_MEMBER_ROLES.Owner ||
      orgMembership?.role === ORG_MEMBER_ROLES.Admin;

    const teamMemberRoleMap = new Map(
      teamMembers.map((member) => [member.userId, member.roleName ?? null]),
    );

    const usersMap = new Map(users.map((user) => [user.id, user]));
    const votesByCard = new Map<string, { cardId: string; userId: string }[]>();
    const commentsByCard = new Map<string, typeof comments>();

    for (const vote of votes) {
      const existing = votesByCard.get(vote.cardId) ?? [];
      existing.push(vote);
      votesByCard.set(vote.cardId, existing);
    }

    for (const comment of comments) {
      const existing = commentsByCard.get(comment.cardId) ?? [];
      existing.push(comment);
      commentsByCard.set(comment.cardId, existing);
    }

    const now = new Date();
    const timerRunning = Boolean(retro.timerEndsAt && retro.timerEndsAt > now);
    const shouldHideAuthor =
      retro.isAnonymous && retro.status !== RETRO_STATUSES.Completed;

    const processedCards = cards.map((card) => {
      const cardVotes = votesByCard.get(card.id) ?? [];
      const cardComments = commentsByCard.get(card.id) ?? [];
      const isOwn = card.authorId === userId;
      const shouldHideContent = timerRunning && !isOwn;
      const authorUser = usersMap.get(card.authorId ?? '');

      const rawVisibleContent = shouldHideContent ? '' : card.content;
      const mergeMetadata = parseMergeMetadata(rawVisibleContent);
      const contentWithoutMeta = removeMergeMetadata(rawVisibleContent);
      const mergedFromMatch = contentWithoutMeta.match(MERGED_FROM_LINE_REGEX);
      const mergedFromNamesFromContent = mergedFromMatch?.[1]
        ? mergedFromMatch[1]
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
        : [];
      const mergedFromNamesFromMeta = (mergeMetadata?.sourceCards ?? [])
        .map((sourceCard) => usersMap.get(sourceCard.authorId)?.name ?? null)
        .filter((name): name is string => Boolean(name?.trim()))
        .map((name) => name.trim());
      const mergedFromNames = shouldHideAuthor
        ? []
        : Array.from(
            new Set(
              mergedFromNamesFromContent.length > 0
                ? mergedFromNamesFromContent
                : mergedFromNamesFromMeta,
            ),
          );

      const cleanedContent = contentWithoutMeta
        .replace(MERGED_FROM_LINE_REGEX, '')
        .replace(/\s+$/, '');

      // Merged cards have the merger's userId as authorId, which is misleading.
      // In anonymous mode, always hide author on merged cards to avoid leaking identity.
      const isMergedCard = Boolean(mergeMetadata?.sourceCards?.length);
      const hideAuthorOnMerge = shouldHideAuthor && isMergedCard;

      // Extract individual source contents for merged card bullet display
      const sourceContents = isMergedCard
        ? (mergeMetadata?.sourceCards ?? []).map((sc) =>
            sc.content.replace(MERGED_FROM_LINE_REGEX, '').replace(/\s+$/, ''),
          )
        : [];

      return {
        id: card.id,
        columnId: card.columnId,
        content: cleanedContent,
        sourceContents,
        mergedFromNames,
        mergedCount: isMergedCard
          ? (mergeMetadata?.sourceCards?.length ?? 0)
          : 0,
        canUnmerge: isMergedCard,
        isDiscussed: card.isDiscussed,
        isCarriedForward: carriedForwardCardIdSet.has(card.id),
        discussedAt: card.discussedAt,
        voteCount: cardVotes.length,
        hasVoted: cardVotes.some((vote) => vote.userId === userId),
        isOwn,
        author:
          (shouldHideAuthor && !isOwn) || hideAuthorOnMerge
            ? null
            : {
                id: card.authorId ?? '',
                name: authorUser?.name ?? null,
                image: authorUser?.image ?? null,
                jobRole: teamMemberRoleMap.get(card.authorId ?? '') ?? null,
              },
        comments: cardComments.map((comment) => {
          const commentAuthor = comment.authorId
            ? usersMap.get(comment.authorId)
            : undefined;

          return {
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            isOwn: comment.authorId === userId,
            author: commentAuthor
              ? {
                  id: commentAuthor.id,
                  name: commentAuthor.name ?? null,
                  image: commentAuthor.image ?? null,
                }
              : null,
          };
        }),
      };
    });

    const userVoteCount = processedCards.reduce(
      (total, card) => total + (card.hasVoted ? 1 : 0),
      0,
    );

    const result = {
      ...retro,
      team: {
        id: team?.id ?? retro.teamId,
        name: team?.name ?? 'Team',
      },
      template: {
        id: template?.id ?? retro.templateId,
        name: template?.name ?? 'Template',
        columns: templateColumns,
      },
      participants: participants.map((p) => ({
        ...p,
        user: usersMap.get(p.userId)
          ? {
              name: usersMap.get(p.userId)!.name,
              image: usersMap.get(p.userId)!.image,
              jobRole: teamMemberRoleMap.get(p.userId) ?? null,
            }
          : null,
      })),
      cards: processedCards,
      timerRunning,
      timeRemaining:
        timerRunning && retro.timerEndsAt
          ? Math.max(
              0,
              Math.floor((retro.timerEndsAt.getTime() - now.getTime()) / 1000),
            )
          : 0,
      userVoteCount,
      isParticipant: participants.some(
        (participant) => participant.userId === userId,
      ),
      isCreator: retro.createdById === userId,
      isTeamLead: membership?.tag === TEAM_MEMBER_TAGS.Lead,
      isOrgAdmin,
      isSystemAdmin,
      currentUserId: userId,
      currentDiscussionCardId: retro.currentDiscussionCardId ?? null,
      currentDiscussionActionItemId:
        retro.currentDiscussionActionItemId ?? null,
    };

    return result;
  }

  /**
   * Start the lobby phase (draft -> waiting).
   * Sets a 15-minute timer for auto-start.
   */
  async startLobby(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean; autoStartsAt: Date }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can start the lobby',
      );
    }

    if (retro.status !== RETRO_STATUSES.Draft) {
      throw new BadRequestException(
        'Retro must be in draft status to start lobby',
      );
    }

    const now = new Date();
    // 3-minute auto-start timer
    const autoStartsAt = new Date(now.getTime() + 3 * 60 * 1000);

    await this.database
      .update(retroSchema.retrospective)
      .set({
        status: RETRO_STATUSES.Waiting,
        lobbyStartedAt: now,
        lobbyAutoStartsAt: autoStartsAt,
        updatedAt: now,
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    // Notify team members that lobby is open
    void this.notificationsService
      .notifyTeamOfRetroLobbyOpen(
        retroId,
        retro.name,
        retro.teamId,
        autoStartsAt,
      )
      .catch(() => undefined);

    return { success: true, autoStartsAt };
  }

  /**
   * Start the retro from waiting/lobby phase (waiting -> active).
   * Can be called early by creator/team lead, or triggered by auto-start timer.
   */
  async startRetro(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can start the retrospective',
      );
    }

    if (
      retro.status !== RETRO_STATUSES.Waiting &&
      retro.status !== RETRO_STATUSES.Draft
    ) {
      throw new BadRequestException(
        'Retro must be in waiting or draft status to start',
      );
    }

    const now = new Date();
    const timerEndsAt = retro.timerDuration
      ? new Date(now.getTime() + retro.timerDuration * 1000)
      : null;

    await this.database
      .update(retroSchema.retrospective)
      .set({
        status: RETRO_STATUSES.Active,
        timerStartedAt: now,
        timerEndsAt,
        lobbyAutoStartsAt: null, // Clear the auto-start timer
        updatedAt: now,
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    // Notify team members in real-time
    void this.notificationsService
      .notifyTeamOfRetroStarted(retroId, retro.name, retro.teamId)
      .catch(() => undefined);

    return { success: true };
  }

  async moveToGrouping(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can control the retrospective',
      );
    }

    if (retro.status !== RETRO_STATUSES.Active) {
      throw new BadRequestException(
        'Retrospective must be in active phase before grouping',
      );
    }

    await this.database
      .update(retroSchema.retrospective)
      .set({
        status: RETRO_STATUSES.Grouping,
        timerEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { success: true };
  }

  async moveToVoting(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can control the retrospective',
      );
    }

    if (retro.status !== RETRO_STATUSES.Grouping) {
      throw new BadRequestException(
        'Retrospective must be in grouping phase before voting',
      );
    }

    await this.database
      .update(retroSchema.retrospective)
      .set({
        status: RETRO_STATUSES.Voting,
        timerEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { success: true };
  }

  async moveToDiscussion(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can control the retrospective',
      );
    }

    if (retro.status !== RETRO_STATUSES.Voting) {
      throw new BadRequestException(
        'Retrospective must be in voting phase before discussion',
      );
    }

    await this.database
      .update(retroSchema.retrospective)
      .set({ status: RETRO_STATUSES.Discussing, updatedAt: new Date() })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { success: true };
  }

  async completeRetro(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [userRecord] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isSystemAdmin =
      userRecord?.role === USER_ROLES.SuperAdmin ||
      userRecord?.role === USER_ROLES.SystemAdmin;

    if (!isSystemAdmin) {
      const [membership] = await this.database
        .select()
        .from(teamSchema.teamMember)
        .where(
          and(
            eq(teamSchema.teamMember.teamId, retro.teamId),
            eq(teamSchema.teamMember.userId, userId),
          ),
        )
        .limit(1);

      if (
        !membership ||
        (membership.tag !== TEAM_MEMBER_TAGS.Lead &&
          retro.createdById !== userId)
      ) {
        throw new ForbiddenException(
          'Only the creator or team lead can complete the retrospective',
        );
      }
    }

    if (retro.status !== RETRO_STATUSES.Discussing) {
      throw new BadRequestException(
        'Retrospective must be in discussing phase before completion',
      );
    }

    const now = new Date();
    await this.database
      .update(retroSchema.retrospective)
      .set({
        status: RETRO_STATUSES.Completed,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { success: true };
  }

  async sendRetroReport(
    userId: string,
    retroId: string,
    data: SendRetroReportDto,
  ): Promise<{ sent: number }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');
    if (retro.status !== RETRO_STATUSES.Completed) {
      throw new BadRequestException(
        'Retrospective must be completed to send report',
      );
    }

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    const [team] = await this.database
      .select({ name: teamSchema.team.name })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, retro.teamId))
      .limit(1);

    const [template] = await this.database
      .select()
      .from(retroSchema.template)
      .where(eq(retroSchema.template.id, retro.templateId))
      .limit(1);

    // Fetch template columns
    const columns = template
      ? await this.database
          .select()
          .from(retroSchema.templateColumn)
          .where(eq(retroSchema.templateColumn.templateId, template.id))
          .orderBy(retroSchema.templateColumn.order)
      : [];

    // Fetch all cards with vote counts
    const cards = await this.database
      .select({
        id: retroSchema.card.id,
        content: retroSchema.card.content,
        columnId: retroSchema.card.columnId,
        isDiscussed: retroSchema.card.isDiscussed,
        voteCount: count(retroSchema.vote.id),
      })
      .from(retroSchema.card)
      .leftJoin(
        retroSchema.vote,
        eq(retroSchema.vote.cardId, retroSchema.card.id),
      )
      .where(eq(retroSchema.card.retroId, retroId))
      .groupBy(retroSchema.card.id);

    const cardIds = cards.map((card) => card.id);
    const cardComments =
      cardIds.length > 0
        ? await this.database
            .select({
              cardId: retroSchema.cardComment.cardId,
              content: retroSchema.cardComment.content,
              authorName: authSchema.user.name,
            })
            .from(retroSchema.cardComment)
            .leftJoin(
              authSchema.user,
              eq(authSchema.user.id, retroSchema.cardComment.authorId),
            )
            .where(inArray(retroSchema.cardComment.cardId, cardIds))
        : [];

    const commentsByCard = new Map<
      string,
      Array<{ content: string; authorName: string | null }>
    >();
    for (const comment of cardComments) {
      const existing = commentsByCard.get(comment.cardId) ?? [];
      existing.push({
        content: comment.content,
        authorName: comment.authorName ?? null,
      });
      commentsByCard.set(comment.cardId, existing);
    }

    // Fetch action items
    const actionItemsResult = await this.database
      .select({
        title: retroSchema.actionItem.title,
        assigneeName: authSchema.user.name,
      })
      .from(retroSchema.actionItem)
      .leftJoin(
        authSchema.user,
        eq(retroSchema.actionItem.assigneeId, authSchema.user.id),
      )
      .where(eq(retroSchema.actionItem.retroId, retroId));

    const actionItems = actionItemsResult.map((item) => ({
      title: item.title,
      assigneeName: item.assigneeName ?? undefined,
    }));

    // Build column summaries
    const columnSummaries = columns.map((col) => {
      const columnCards = cards.filter((c) => c.columnId === col.id);
      const discussedCards = columnCards.filter((c) => c.isDiscussed);
      const cleanCardContent = (content: string) =>
        removeMergeMetadata(content)
          .replace(MERGED_FROM_LINE_REGEX, '')
          .replace(/\s+$/, '');
      const extractSourceContents = (content: string) => {
        const mergeMetadata = parseMergeMetadata(content);
        const sourceContents = (mergeMetadata?.sourceCards ?? [])
          .map((sourceCard) =>
            sourceCard.content
              .replace(MERGED_FROM_LINE_REGEX, '')
              .replace(/\s+$/, ''),
          )
          .filter(Boolean);

        return sourceContents.length > 1 ? sourceContents : undefined;
      };
      const topCards = columnCards
        .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
        .map((c) => ({
          content: cleanCardContent(c.content),
          votes: c.voteCount ?? 0,
          comments: commentsByCard.get(c.id) ?? [],
          sourceContents: extractSourceContents(c.content),
        }));

      return {
        name: col.name,
        emoji: col.emoji || '•',
        discussedCount: discussedCards.length,
        undiscussedCount: columnCards.length - discussedCards.length,
        topCards,
      };
    });

    // Determine recipients
    let recipients: string[] = [];
    if (data.recipients && data.recipients.length > 0) {
      recipients = data.recipients;
    } else {
      // Fetch all team members' emails
      const teamMembers = await this.database
        .select({ email: authSchema.user.email })
        .from(teamSchema.teamMember)
        .innerJoin(
          authSchema.user,
          eq(authSchema.user.id, teamSchema.teamMember.userId),
        )
        .where(eq(teamSchema.teamMember.teamId, retro.teamId));

      recipients = teamMembers.map((m) => m.email);
    }

    // Build report HTML once
    const html = this.emailService.buildRetroReportHtml({
      recipientName: 'Team Member',
      retroName: retro.name,
      teamName: team?.name ?? 'Team',
      completedAt: (retro.completedAt || new Date()).toLocaleDateString(),
      stats: {
        participants: new Set(cards.map((c) => c.id)).size, // rough approximation
        totalCards: cards.length,
        discussedCards: cards.filter((c) => c.isDiscussed).length,
        undiscussedCards: cards.filter((c) => !c.isDiscussed).length,
        totalVotes: cards.reduce((sum, c) => sum + (c.voteCount ?? 0), 0),
        actionItems: actionItems.length,
      },
      columns: columnSummaries,
      actionItems,
    });

    // Send email to each recipient
    let successCount = 0;
    for (const email of recipients) {
      const sent = await this.emailService.send({
        to: email,
        subject: `Retrospective Report: ${retro.name}`,
        html,
        userId,
        type: EMAIL_LOG_TYPES.RetroReport,
      });
      if (sent) successCount++;
    }

    return { sent: successCount };
  }

  async mergeCards(
    userId: string,
    retroId: string,
    data: { cardIds: string[]; content?: string; columnId?: string },
  ): Promise<{ success: boolean; id: string }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    if (retro.status !== RETRO_STATUSES.Grouping) {
      throw new BadRequestException(
        'Cards can only be merged in grouping phase',
      );
    }

    const uniqueCardIds = Array.from(new Set(data.cardIds));
    if (uniqueCardIds.length < 2) {
      throw new BadRequestException('Select at least two cards to merge');
    }

    const cards = await this.database
      .select()
      .from(retroSchema.card)
      .where(inArray(retroSchema.card.id, uniqueCardIds));

    if (cards.length !== uniqueCardIds.length) {
      throw new NotFoundException('One or more cards were not found');
    }

    if (cards.some((card) => card.retroId !== retroId)) {
      throw new BadRequestException(
        'All cards must belong to this retrospective',
      );
    }

    // Prevent cross-column merging
    const uniqueColumnIds = new Set(cards.map((card) => card.columnId));
    if (uniqueColumnIds.size > 1) {
      throw new BadRequestException(
        'Cards can only be merged within the same column',
      );
    }

    // Flatten nested merges: if a source card was itself merged, use its
    // leaf source cards so that unmerge always restores the original cards.
    const flatSourceCards: MergeSourceCardSnapshot[] = [];
    for (const card of cards) {
      const existingMeta = parseMergeMetadata(card.content);
      if (existingMeta && existingMeta.sourceCards.length > 0) {
        flatSourceCards.push(...existingMeta.sourceCards);
      } else {
        flatSourceCards.push({
          authorId: card.authorId ?? '',
          columnId: card.columnId,
          // Store cleaned content so restored cards don't carry MERGE_META
          content: removeMergeMetadata(card.content)
            .replace(MERGED_FROM_LINE_REGEX, '')
            .replace(/\s+$/, ''),
        });
      }
    }

    // De-duplicate leaf source cards
    const seen = new Set<string>();
    const deduplicatedSourceCards = flatSourceCards.filter((sc) => {
      const key = `${sc.authorId}::${sc.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mergeMetadata: MergeMetadata = {
      version: 1,
      sourceCards: deduplicatedSourceCards,
    };
    const mergeMetadataMarker = `[MERGE_META:${Buffer.from(
      JSON.stringify(mergeMetadata),
      'utf8',
    ).toString('base64')}]`;

    const targetColumnId = data.columnId ?? cards[0].columnId;
    // Strip MERGE_META and "Merged from:" lines from source card content before combining
    const cleanedContents = cards
      .map((card) =>
        removeMergeMetadata(card.content)
          .replace(MERGED_FROM_LINE_REGEX, '')
          .replace(/\s+$/, ''),
      )
      .filter(Boolean);
    const baseMergedContent =
      data.content?.trim() || cleanedContents.join('\n\n');
    const mergedContent = `${baseMergedContent}\n\n${mergeMetadataMarker}`;

    if (!mergedContent) {
      throw new BadRequestException('Merged content cannot be empty');
    }

    const mergedCardId = generateId();

    await this.database.insert(retroSchema.card).values({
      id: mergedCardId,
      retroId,
      columnId: targetColumnId,
      authorId: userId,
      content: mergedContent,
    });

    await this.database
      .delete(retroSchema.card)
      .where(inArray(retroSchema.card.id, uniqueCardIds));

    await this.invalidateRetroCache(retroId);

    return { success: true, id: mergedCardId };
  }

  async unmergeCard(
    userId: string,
    retroId: string,
    mergedCardId: string,
  ): Promise<{ success: boolean; restoredCount: number }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    if (retro.status !== RETRO_STATUSES.Grouping) {
      throw new BadRequestException(
        'Cards can only be unmerged in grouping phase',
      );
    }

    const [mergedCard] = await this.database
      .select()
      .from(retroSchema.card)
      .where(
        and(
          eq(retroSchema.card.id, mergedCardId),
          eq(retroSchema.card.retroId, retroId),
        ),
      )
      .limit(1);

    if (!mergedCard) {
      throw new NotFoundException('Merged card not found');
    }

    const mergeMetadata = parseMergeMetadata(mergedCard.content);
    if (!mergeMetadata || mergeMetadata.sourceCards.length === 0) {
      throw new BadRequestException('This card does not have unmerge history');
    }

    await this.database.insert(retroSchema.card).values(
      mergeMetadata.sourceCards.map((sourceCard) => ({
        id: generateId(),
        retroId,
        columnId: sourceCard.columnId,
        authorId: sourceCard.authorId,
        content: sourceCard.content,
      })),
    );

    await this.database
      .delete(retroSchema.card)
      .where(eq(retroSchema.card.id, mergedCardId));

    await this.invalidateRetroCache(retroId);

    return { success: true, restoredCount: mergeMetadata.sourceCards.length };
  }

  async joinRetro(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You must be a team member to join this retrospective',
      );
    }

    await this.database
      .insert(retroSchema.retroParticipant)
      .values({ id: generateId(), retroId, userId })
      .onConflictDoNothing({
        target: [
          retroSchema.retroParticipant.retroId,
          retroSchema.retroParticipant.userId,
        ],
      });

    return { success: true };
  }

  // ============================================================================
  // Card Methods
  // ============================================================================

  async createCard(
    userId: string,
    data: CreateCardDto,
  ): Promise<{ id: string }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, data.retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    if (
      retro.status !== RETRO_STATUSES.Active &&
      retro.status !== RETRO_STATUSES.Draft
    ) {
      throw new BadRequestException('Cannot add cards in this phase');
    }

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You must be a team member to add cards');
    }

    const cardId = generateId();

    await this.database.insert(retroSchema.card).values({
      id: cardId,
      retroId: data.retroId,
      columnId: data.columnId,
      authorId: userId,
      content: data.content,
    });

    await this.invalidateRetroCache(data.retroId);

    return { id: cardId };
  }

  async updateCard(
    userId: string,
    cardId: string,
    data: UpdateCardDto,
  ): Promise<{ success: boolean; retroId: string }> {
    const [existingCard] = await this.database
      .select()
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!existingCard) throw new NotFoundException('Card not found');

    if (existingCard.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own cards');
    }

    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, existingCard.retroId))
      .limit(1);

    if (retro?.status === RETRO_STATUSES.Completed) {
      throw new BadRequestException(
        'Cannot edit cards in a completed retrospective',
      );
    }

    await this.database
      .update(retroSchema.card)
      .set({ content: data.content, updatedAt: new Date() })
      .where(eq(retroSchema.card.id, cardId));

    await this.invalidateRetroCache(existingCard.retroId);

    return { success: true, retroId: existingCard.retroId };
  }

  async deleteCard(
    userId: string,
    cardId: string,
  ): Promise<{ success: boolean; retroId: string }> {
    const [existingCard] = await this.database
      .select()
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!existingCard) throw new NotFoundException('Card not found');

    if (existingCard.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own cards');
    }

    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, existingCard.retroId))
      .limit(1);

    if (retro?.status === RETRO_STATUSES.Completed) {
      throw new BadRequestException(
        'Cannot delete cards in a completed retrospective',
      );
    }

    await this.database
      .delete(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId));

    await this.invalidateRetroCache(existingCard.retroId);

    return { success: true, retroId: existingCard.retroId };
  }

  // ============================================================================
  // Voting Methods
  // ============================================================================

  async voteForCard(
    userId: string,
    cardId: string,
  ): Promise<{ success: boolean; retroId: string }> {
    const [cardData] = await this.database
      .select()
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!cardData) throw new NotFoundException('Card not found');

    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, cardData.retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    if (retro.status !== RETRO_STATUSES.Voting) {
      throw new BadRequestException('Voting is not active');
    }

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You must be a team member to vote');
    }

    const [existingVote] = await this.database
      .select()
      .from(retroSchema.vote)
      .where(
        and(
          eq(retroSchema.vote.cardId, cardId),
          eq(retroSchema.vote.userId, userId),
        ),
      )
      .limit(1);

    if (existingVote) {
      throw new BadRequestException('You have already voted on this card');
    }

    const [userVoteCount] = await this.database
      .select({ count: count() })
      .from(retroSchema.vote)
      .innerJoin(
        retroSchema.card,
        eq(retroSchema.vote.cardId, retroSchema.card.id),
      )
      .where(
        and(
          eq(retroSchema.card.retroId, retro.id),
          eq(retroSchema.vote.userId, userId),
        ),
      );

    const currentVotes = userVoteCount?.count ?? 0;

    if (retro.voteType === 'single' && currentVotes >= 1) {
      throw new BadRequestException(
        'You can only vote once in single-vote mode',
      );
    }

    if (currentVotes >= retro.maxVotesPerUser) {
      throw new BadRequestException(
        `You have used all ${retro.maxVotesPerUser} votes`,
      );
    }

    await this.database.insert(retroSchema.vote).values({
      id: generateId(),
      cardId,
      userId,
    });

    await this.invalidateRetroCache(cardData.retroId);

    return { success: true, retroId: cardData.retroId };
  }

  async removeVote(
    userId: string,
    cardId: string,
  ): Promise<{ success: boolean; retroId: string }> {
    const [cardData] = await this.database
      .select()
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!cardData) throw new NotFoundException('Card not found');

    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, cardData.retroId))
      .limit(1);

    if (retro?.status !== RETRO_STATUSES.Voting) {
      throw new BadRequestException('Voting is not active');
    }

    await this.database
      .delete(retroSchema.vote)
      .where(
        and(
          eq(retroSchema.vote.cardId, cardId),
          eq(retroSchema.vote.userId, userId),
        ),
      );

    await this.invalidateRetroCache(cardData.retroId);

    return { success: true, retroId: cardData.retroId };
  }

  // ============================================================================
  // Comment Methods
  // ============================================================================

  async createComment(
    userId: string,
    cardId: string,
    data: CreateCommentDto,
  ): Promise<{ id: string; retroId: string }> {
    const [cardData] = await this.database
      .select()
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!cardData) throw new NotFoundException('Card not found');

    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, cardData.retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You must be a team member to comment');
    }

    const commentId = generateId();

    await this.database.insert(retroSchema.cardComment).values({
      id: commentId,
      cardId,
      authorId: userId,
      content: data.content,
    });

    await this.invalidateRetroCache(cardData.retroId);

    return { id: commentId, retroId: cardData.retroId };
  }

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<{ success: boolean; retroId: string | null }> {
    const [comment] = await this.database
      .select()
      .from(retroSchema.cardComment)
      .where(eq(retroSchema.cardComment.id, commentId))
      .limit(1);

    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    const [card] = await this.database
      .select({ retroId: retroSchema.card.retroId })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, comment.cardId))
      .limit(1);

    await this.database
      .delete(retroSchema.cardComment)
      .where(eq(retroSchema.cardComment.id, commentId));

    if (card?.retroId) {
      await this.invalidateRetroCache(card.retroId);
    }

    return { success: true, retroId: card?.retroId ?? null };
  }

  // ============================================================================
  // Dashboard Methods
  // ============================================================================

  async getDashboardStats(userId: string): Promise<{
    totalRetros: number;
    totalTeams: number;
    totalCards: number;
    totalVotes: number;
  }> {
    const [fullUser] = await this.database
      .select()
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    if (!fullUser) throw new NotFoundException('User not found');

    if (
      fullUser.role === USER_ROLES.SuperAdmin ||
      fullUser.role === USER_ROLES.SystemAdmin
    ) {
      const [retroCount] = await this.database
        .select({ count: count() })
        .from(retroSchema.retrospective);
      const [teamCount] = await this.database
        .select({ count: count() })
        .from(teamSchema.team);
      const [cardCount] = await this.database
        .select({ count: count() })
        .from(retroSchema.card);
      const [voteCount] = await this.database
        .select({ count: count() })
        .from(retroSchema.vote);

      return {
        totalRetros: retroCount?.count ?? 0,
        totalTeams: teamCount?.count ?? 0,
        totalCards: cardCount?.count ?? 0,
        totalVotes: voteCount?.count ?? 0,
      };
    }

    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    const teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length === 0) {
      return { totalRetros: 0, totalTeams: 0, totalCards: 0, totalVotes: 0 };
    }

    const [retroCount] = await this.database
      .select({ count: count() })
      .from(retroSchema.retrospective)
      .where(inArray(retroSchema.retrospective.teamId, teamIds));

    const retroRows = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(inArray(retroSchema.retrospective.teamId, teamIds));

    const retroIds = retroRows.map((r) => r.id);

    const [cardCount] =
      retroIds.length > 0
        ? await this.database
            .select({ count: count() })
            .from(retroSchema.card)
            .where(inArray(retroSchema.card.retroId, retroIds))
        : [{ count: 0 }];

    const cardRows =
      retroIds.length > 0
        ? await this.database
            .select({ id: retroSchema.card.id })
            .from(retroSchema.card)
            .where(inArray(retroSchema.card.retroId, retroIds))
        : [];

    const cardIds = cardRows.map((c) => c.id);

    const [voteCount] =
      cardIds.length > 0
        ? await this.database
            .select({ count: count() })
            .from(retroSchema.vote)
            .where(inArray(retroSchema.vote.cardId, cardIds))
        : [{ count: 0 }];

    return {
      totalRetros: retroCount?.count ?? 0,
      totalTeams: teamIds.length,
      totalCards: cardCount?.count ?? 0,
      totalVotes: voteCount?.count ?? 0,
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    content: string,
  ): Promise<CardComment & { retroId: string | null }> {
    const [comment] = await this.database
      .select()
      .from(retroSchema.cardComment)
      .where(eq(retroSchema.cardComment.id, commentId))
      .limit(1);

    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const [card] = await this.database
      .select({ retroId: retroSchema.card.retroId })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, comment.cardId))
      .limit(1);

    const [updated] = await this.database
      .update(retroSchema.cardComment)
      .set({ content, updatedAt: new Date() })
      .where(eq(retroSchema.cardComment.id, commentId))
      .returning();

    if (card?.retroId) {
      await this.invalidateRetroCache(card.retroId);
    }

    return { ...updated, retroId: card?.retroId ?? null };
  }

  async getRetroActionItems(
    userId: string,
    retroId: string,
  ): Promise<ActionItem[]> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('Not a team member');
    }

    return this.database
      .select()
      .from(retroSchema.actionItem)
      .where(eq(retroSchema.actionItem.retroId, retroId))
      .orderBy(desc(retroSchema.actionItem.createdAt));
  }

  // ============================================================================
  // Discussion Methods
  // ============================================================================

  private async assertRetroModerator(
    userId: string,
    retroId: string,
  ): Promise<typeof retroSchema.retrospective.$inferSelect> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (
      !membership ||
      (membership.tag !== TEAM_MEMBER_TAGS.Lead && retro.createdById !== userId)
    ) {
      throw new ForbiddenException(
        'Only the creator or team lead can control the discussion',
      );
    }

    return retro;
  }

  async setCurrentDiscussionCard(
    userId: string,
    retroId: string,
    cardId: string,
  ): Promise<{ success: boolean }> {
    const retro = await this.assertRetroModerator(userId, retroId);

    if (retro.status !== RETRO_STATUSES.Discussing) {
      throw new BadRequestException(
        'Can only set discussion card during the discussing phase',
      );
    }

    await this.database
      .update(retroSchema.retrospective)
      .set({
        currentDiscussionCardId: cardId,
        // Clear action item discussion when switching to card
        currentDiscussionActionItemId: null,
        updatedAt: new Date(),
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId);

    return { success: true };
  }

  async setCurrentDiscussionActionItem(
    userId: string,
    retroId: string,
    actionItemId: string,
  ): Promise<{ success: boolean }> {
    const retro = await this.assertRetroModerator(userId, retroId);

    if (retro.status !== RETRO_STATUSES.Discussing) {
      throw new BadRequestException(
        'Can only set discussion action item during the discussing phase',
      );
    }

    const now = new Date();

    // Update the action item status to in_progress
    await this.database
      .update(retroSchema.actionItem)
      .set({ status: ACTION_ITEM_STATUSES.InProgress, updatedAt: now })
      .where(eq(retroSchema.actionItem.id, actionItemId));

    await this.database
      .update(retroSchema.retrospective)
      .set({
        currentDiscussionActionItemId: actionItemId,
        // Clear card discussion when switching to action item
        currentDiscussionCardId: null,
        updatedAt: now,
      })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId);

    return { success: true };
  }

  async markCardDiscussed(
    userId: string,
    retroId: string,
    cardId: string,
  ): Promise<{ success: boolean }> {
    const retro = await this.assertRetroModerator(userId, retroId);

    if (retro.status !== RETRO_STATUSES.Discussing) {
      throw new BadRequestException(
        'Can only mark cards as discussed during the discussing phase',
      );
    }

    const [existingCard] = await this.database
      .select({ id: retroSchema.card.id, retroId: retroSchema.card.retroId })
      .from(retroSchema.card)
      .where(eq(retroSchema.card.id, cardId))
      .limit(1);

    if (!existingCard || existingCard.retroId !== retroId) {
      throw new NotFoundException('Card not found in this retrospective');
    }

    const now = new Date();
    await this.database
      .update(retroSchema.card)
      .set({ isDiscussed: true, discussedAt: now, updatedAt: now })
      .where(eq(retroSchema.card.id, cardId));

    await this.database
      .update(retroSchema.retrospective)
      .set({ currentDiscussionCardId: null, updatedAt: now })
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId);

    return { success: true };
  }

  async carryForwardCards(
    userId: string,
    retroId: string,
    cardIds: string[],
  ): Promise<{ created: number }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('Not a team member');
    }

    // Only the retro creator or a team lead can carry forward cards
    if (
      retro.createdById !== userId &&
      membership.tag !== TEAM_MEMBER_TAGS.Lead
    ) {
      throw new ForbiddenException(
        'Only the retro creator or team lead can carry forward cards',
      );
    }

    if (retro.status !== RETRO_STATUSES.Completed) {
      throw new BadRequestException(
        'Can only carry forward cards after the retro is completed',
      );
    }

    if (cardIds.length === 0) {
      return { created: 0 };
    }

    const cards = await this.database
      .select()
      .from(retroSchema.card)
      .where(
        and(
          inArray(retroSchema.card.id, cardIds),
          eq(retroSchema.card.retroId, retroId),
        ),
      );

    // Find cards that already have a carried-forward action item to prevent duplicates
    const existingCarriedItems =
      cards.length > 0
        ? await this.database
            .select({ cardId: retroSchema.actionItem.cardId })
            .from(retroSchema.actionItem)
            .where(
              and(
                inArray(
                  retroSchema.actionItem.cardId,
                  cards.map((c) => c.id),
                ),
                eq(retroSchema.actionItem.isCarriedForward, true),
              ),
            )
        : [];

    const alreadyCarriedCardIds = new Set(
      existingCarriedItems.map((item) => item.cardId).filter(Boolean),
    );
    const newCards = cards.filter((c) => !alreadyCarriedCardIds.has(c.id));

    for (const card of newCards) {
      const cleanTitle = removeMergeMetadata(card.content)
        .replace(MERGED_FROM_LINE_REGEX, '')
        .replace(/\s+$/, '')
        .substring(0, 255);
      await this.database.insert(retroSchema.actionItem).values({
        id: generateId(),
        retroId,
        cardId: card.id,
        title: cleanTitle || card.content.substring(0, 255),
        description: `Carried forward from retro — not discussed`,
        status: ACTION_ITEM_STATUSES.Pending,
        isCarriedForward: true,
      });
    }

    return { created: newCards.length };
  }

  async createActionItem(
    userId: string,
    retroId: string,
    data: { title: string; description?: string; isCarriedForward?: boolean },
  ) {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Not a team member');

    const [item] = await this.database
      .insert(retroSchema.actionItem)
      .values({
        id: generateId(),
        retroId,
        title: data.title.substring(0, 255),
        description: data.description ?? null,
        status: ACTION_ITEM_STATUSES.Pending,
        isCarriedForward: data.isCarriedForward ?? false,
      })
      .returning();

    return item;
  }

  async deleteRetro(
    userId: string,
    retroId: string,
  ): Promise<{ success: boolean }> {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [userRecord] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isSystemAdmin =
      userRecord?.role === USER_ROLES.SuperAdmin ||
      userRecord?.role === USER_ROLES.SystemAdmin;

    if (!isSystemAdmin) {
      const [membership] = await this.database
        .select()
        .from(teamSchema.teamMember)
        .where(
          and(
            eq(teamSchema.teamMember.teamId, retro.teamId),
            eq(teamSchema.teamMember.userId, userId),
          ),
        )
        .limit(1);

      const isCreator = retro.createdById === userId;
      const isTeamLead = membership?.tag === TEAM_MEMBER_TAGS.Lead;

      const [teamRecord] = await this.database
        .select({ organizationId: teamSchema.team.organizationId })
        .from(teamSchema.team)
        .where(eq(teamSchema.team.id, retro.teamId))
        .limit(1);

      const isOrgAdmin = teamRecord
        ? await this.database
            .select({ role: orgSchema.organizationMember.role })
            .from(orgSchema.organizationMember)
            .where(
              and(
                eq(orgSchema.organizationMember.userId, userId),
                eq(
                  orgSchema.organizationMember.organizationId,
                  teamRecord.organizationId,
                ),
              ),
            )
            .limit(1)
            .then(
              ([m]) =>
                m?.role === ORG_MEMBER_ROLES.Owner ||
                m?.role === ORG_MEMBER_ROLES.Admin,
            )
        : false;

      if (!isCreator && !isTeamLead && !isOrgAdmin) {
        throw new ForbiddenException(
          'Only system admins, org admins, team leads, and the retro creator can delete a retrospective',
        );
      }
    }

    await this.database
      .delete(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId));

    await this.invalidateRetroCache(retroId, { invalidateLists: true });

    return { success: true };
  }

  async getPreviousCarriedForward(userId: string, retroId: string) {
    const [retro] = await this.database
      .select()
      .from(retroSchema.retrospective)
      .where(eq(retroSchema.retrospective.id, retroId))
      .limit(1);

    if (!retro) throw new NotFoundException('Retrospective not found');

    const [membership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Not a team member');

    // Find the most recent completed retro for this team before the current one
    const [prevRetro] = await this.database
      .select({ id: retroSchema.retrospective.id })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.teamId, retro.teamId),
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Completed),
          lt(retroSchema.retrospective.createdAt, retro.createdAt),
        ),
      )
      .orderBy(desc(retroSchema.retrospective.createdAt))
      .limit(1);

    if (!prevRetro) return [];

    const items = await this.database
      .select()
      .from(retroSchema.actionItem)
      .where(
        and(
          eq(retroSchema.actionItem.retroId, prevRetro.id),
          eq(retroSchema.actionItem.isCarriedForward, true),
          inArray(retroSchema.actionItem.status, [
            ACTION_ITEM_STATUSES.Pending,
            ACTION_ITEM_STATUSES.InProgress,
          ]),
        ),
      )
      .orderBy(desc(retroSchema.actionItem.createdAt));

    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((item) => item.id);

    // Fetch cards to extract sourceContents for merged cards
    const cardIds = items
      .map((item) => item.cardId)
      .filter(Boolean) as string[];
    const cards =
      cardIds.length > 0
        ? await this.database
            .select({
              id: retroSchema.card.id,
              content: retroSchema.card.content,
            })
            .from(retroSchema.card)
            .where(inArray(retroSchema.card.id, cardIds))
        : [];
    const cardsMap = new Map(cards.map((c) => [c.id, c]));

    const comments = await this.database
      .select()
      .from(retroSchema.actionItemComment)
      .where(inArray(retroSchema.actionItemComment.actionItemId, itemIds))
      .orderBy(retroSchema.actionItemComment.createdAt);

    const likes = await this.database
      .select({
        actionItemId: retroSchema.actionItemLike.actionItemId,
        userId: retroSchema.actionItemLike.userId,
      })
      .from(retroSchema.actionItemLike)
      .where(inArray(retroSchema.actionItemLike.actionItemId, itemIds));

    const authorIds = Array.from(new Set(comments.map((c) => c.authorId)));
    const commentAuthors =
      authorIds.length > 0
        ? await this.database
            .select({
              id: authSchema.user.id,
              name: authSchema.user.name,
              image: authSchema.user.image,
            })
            .from(authSchema.user)
            .where(inArray(authSchema.user.id, authorIds))
        : [];

    const authorsMap = new Map(commentAuthors.map((u) => [u.id, u]));
    const commentsByItemId = new Map<string, (typeof comments)[number][]>();
    const likesByItemId = new Map<
      string,
      { actionItemId: string; userId: string }[]
    >();

    for (const comment of comments) {
      const existing = commentsByItemId.get(comment.actionItemId) ?? [];
      existing.push(comment);
      commentsByItemId.set(comment.actionItemId, existing);
    }

    for (const like of likes) {
      const existing = likesByItemId.get(like.actionItemId) ?? [];
      existing.push(like);
      likesByItemId.set(like.actionItemId, existing);
    }

    return items.map((item) => {
      const itemComments = commentsByItemId.get(item.id) ?? [];
      const itemLikes = likesByItemId.get(item.id) ?? [];

      // Extract sourceContents from card merge metadata
      let sourceContents: string[] = [];
      if (item.cardId) {
        const card = cardsMap.get(item.cardId);
        if (card) {
          const mergeMetadata = parseMergeMetadata(card.content);
          if (mergeMetadata?.sourceCards?.length) {
            sourceContents = mergeMetadata.sourceCards.map((sc) =>
              sc.content
                .replace(MERGED_FROM_LINE_REGEX, '')
                .replace(/\s+$/, ''),
            );
          }
        }
      }

      return {
        ...item,
        sourceContents,
        likesCount: itemLikes.length,
        hasLiked: itemLikes.some((like) => like.userId === userId),
        comments: itemComments.map((comment) => {
          const author = authorsMap.get(comment.authorId);
          return {
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            isOwn: comment.authorId === userId,
            author: author
              ? {
                  id: author.id,
                  name: author.name,
                  image: author.image,
                }
              : null,
          };
        }),
      };
    });
  }
}
