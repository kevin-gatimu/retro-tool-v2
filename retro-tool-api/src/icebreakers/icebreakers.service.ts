import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  inArray,
  count,
  desc,
  asc,
  ilike,
  or,
  type SQL,
} from 'drizzle-orm';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { generateSeed, seededShuffle } from '../lib/seeded-random';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIcebreakerSessionDto } from './dtos';
import {
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_PROMPT_DECISIONS,
  ICEBREAKER_SELECTION_MODES,
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  type TIcebreakerFlavour,
  type TIcebreakerPromptDecision,
} from '../common/enums';
import type { IcebreakerSession, IcebreakerSessionPrompt } from './schema';
import type {
  DeckPromptView,
  SessionDetail,
  SessionSummary,
  SessionTemplate,
} from './types/index';

const MAX_DECK_SIZE = 20;

type Database = NodePgDatabase<
  typeof icebreakersSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

@Injectable()
export class IcebreakersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================================================
  // Record / permission helpers
  // ==========================================================================

  private async getSessionRecord(
    sessionId: string,
  ): Promise<IcebreakerSession> {
    const [session] = await this.database
      .select()
      .from(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async canManageSession(sessionId: string, userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({
        createdById: icebreakersSchema.icebreakerSession.createdById,
        teamId: icebreakersSchema.icebreakerSession.teamId,
        orgId: teamSchema.team.organizationId,
      })
      .from(icebreakersSchema.icebreakerSession)
      .leftJoin(
        teamSchema.team,
        eq(icebreakersSchema.icebreakerSession.teamId, teamSchema.team.id),
      )
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('Session not found');

    if (row.createdById === userId) return true;

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const role = fullUser?.role;

    if (role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin) {
      return true;
    }

    if (row.orgId) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.organizationId, row.orgId),
            eq(orgSchema.organizationMember.userId, userId),
          ),
        )
        .limit(1);

      if (
        orgMembership?.role === ORG_MEMBER_ROLES.Owner ||
        orgMembership?.role === ORG_MEMBER_ROLES.Admin
      ) {
        return true;
      }
    }

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, row.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return teamMembership?.tag === TEAM_MEMBER_TAGS.Lead;
  }

  private async assertCanManage(
    sessionId: string,
    userId: string,
  ): Promise<IcebreakerSession> {
    const canManage = await this.canManageSession(sessionId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the session host, team lead, or admin can do this action',
      );
    }
    return this.getSessionRecord(sessionId);
  }

  private async getCurrentPendingPrompt(
    sessionId: string,
  ): Promise<IcebreakerSessionPrompt | null> {
    const [prompt] = await this.database
      .select()
      .from(icebreakersSchema.icebreakerSessionPrompt)
      .where(
        and(
          eq(icebreakersSchema.icebreakerSessionPrompt.sessionId, sessionId),
          eq(
            icebreakersSchema.icebreakerSessionPrompt.decision,
            ICEBREAKER_PROMPT_DECISIONS.Pending,
          ),
        ),
      )
      .orderBy(asc(icebreakersSchema.icebreakerSessionPrompt.deckOrder))
      .limit(1);

    return prompt ?? null;
  }

  // ==========================================================================
  // List / detail
  // ==========================================================================

  async getSessions(userId: string): Promise<SessionSummary[]> {
    const memberships = await this.database
      .select({ teamId: teamSchema.teamMember.teamId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.userId, userId));

    if (!memberships.length) return [];

    const teamIds = memberships.map((m) => m.teamId);

    const rows = await this.database
      .select({
        session: icebreakersSchema.icebreakerSession,
        team: {
          id: teamSchema.team.id,
          name: teamSchema.team.name,
          emoji: teamSchema.team.emoji,
        },
      })
      .from(icebreakersSchema.icebreakerSession)
      .leftJoin(
        teamSchema.team,
        eq(icebreakersSchema.icebreakerSession.teamId, teamSchema.team.id),
      )
      .where(inArray(icebreakersSchema.icebreakerSession.teamId, teamIds));

    return Promise.all(
      rows.map(async (row) => {
        const participants = await this.database
          .select({
            userId: icebreakersSchema.icebreakerParticipant.userId,
            isOnline: icebreakersSchema.icebreakerParticipant.isOnline,
          })
          .from(icebreakersSchema.icebreakerParticipant)
          .where(
            eq(
              icebreakersSchema.icebreakerParticipant.sessionId,
              row.session.id,
            ),
          );

        return {
          ...row.session,
          team: row.team ?? {
            id: row.session.teamId,
            name: 'Unknown Team',
            emoji: null,
          },
          participants,
        };
      }),
    );
  }

  async getActiveSessions(userId: string): Promise<SessionSummary[]> {
    const all = await this.getSessions(userId);
    return all.filter(
      (s) => s.status !== ICEBREAKER_SESSION_STATUSES.Completed,
    );
  }

  async getSession(userId: string, sessionId: string): Promise<SessionDetail> {
    const [row] = await this.database
      .select({
        session: icebreakersSchema.icebreakerSession,
        team: {
          id: teamSchema.team.id,
          name: teamSchema.team.name,
        },
        createdBy: {
          id: authSchema.user.id,
          name: authSchema.user.name,
          image: authSchema.user.image,
        },
      })
      .from(icebreakersSchema.icebreakerSession)
      .leftJoin(
        teamSchema.team,
        eq(icebreakersSchema.icebreakerSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        authSchema.user,
        eq(icebreakersSchema.icebreakerSession.createdById, authSchema.user.id),
      )
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!row) throw new NotFoundException('Session not found');

    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, row.session.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Access denied');

    // Template (if any)
    let sessionTemplate: SessionTemplate | null = null;
    if (row.session.templateId) {
      const [tmpl] = await this.database
        .select({
          id: icebreakersSchema.icebreakerTemplate.id,
          name: icebreakersSchema.icebreakerTemplate.name,
          flavour: icebreakersSchema.icebreakerTemplate.flavour,
          color: icebreakersSchema.icebreakerTemplate.color,
        })
        .from(icebreakersSchema.icebreakerTemplate)
        .where(
          eq(icebreakersSchema.icebreakerTemplate.id, row.session.templateId),
        )
        .limit(1);

      if (tmpl) {
        const prompts = await this.database
          .select()
          .from(icebreakersSchema.icebreakerPrompt)
          .where(eq(icebreakersSchema.icebreakerPrompt.templateId, tmpl.id))
          .orderBy(asc(icebreakersSchema.icebreakerPrompt.order));

        sessionTemplate = {
          id: tmpl.id,
          name: tmpl.name,
          flavour: tmpl.flavour,
          color: tmpl.color ?? null,
          prompts: prompts.map((p) => ({
            id: p.id,
            text: p.text,
            order: p.order,
            color: p.color ?? null,
          })),
        };
      }
    }

    // Participants
    const rawParticipants = await this.database
      .select({
        id: icebreakersSchema.icebreakerParticipant.id,
        userId: icebreakersSchema.icebreakerParticipant.userId,
        isOnline: icebreakersSchema.icebreakerParticipant.isOnline,
        joinedAt: icebreakersSchema.icebreakerParticipant.joinedAt,
        userName: authSchema.user.name,
        userImage: authSchema.user.image,
        userId2: authSchema.user.id,
        jobRole: teamSchema.teamRole.name,
      })
      .from(icebreakersSchema.icebreakerParticipant)
      .innerJoin(
        authSchema.user,
        eq(icebreakersSchema.icebreakerParticipant.userId, authSchema.user.id),
      )
      .leftJoin(
        teamSchema.teamMember,
        and(
          eq(
            teamSchema.teamMember.userId,
            icebreakersSchema.icebreakerParticipant.userId,
          ),
          eq(teamSchema.teamMember.teamId, row.session.teamId),
        ),
      )
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .where(eq(icebreakersSchema.icebreakerParticipant.sessionId, sessionId));

    // Deck (session prompts)
    const deckRows = await this.database
      .select()
      .from(icebreakersSchema.icebreakerSessionPrompt)
      .where(eq(icebreakersSchema.icebreakerSessionPrompt.sessionId, sessionId))
      .orderBy(asc(icebreakersSchema.icebreakerSessionPrompt.deckOrder));

    const participants = rawParticipants.map((p) => ({
      id: p.id,
      userId: p.userId,
      isOnline: p.isOnline,
      joinedAt: p.joinedAt,
      user: {
        id: p.userId2,
        name: p.userName,
        image: p.userImage,
        jobRole: p.jobRole ?? null,
      },
    }));

    const deck: DeckPromptView[] = deckRows.map((promptRow) => ({
      id: promptRow.id,
      text: promptRow.text,
      deckOrder: promptRow.deckOrder,
      decision: promptRow.decision,
      presentedAt: promptRow.presentedAt ?? null,
    }));

    const currentPrompt = row.session.currentPromptId
      ? (deck.find((p) => p.id === row.session.currentPromptId) ?? null)
      : null;

    const pendingCount = deck.filter(
      (p) => p.decision === ICEBREAKER_PROMPT_DECISIONS.Pending,
    ).length;

    const isCreator = row.session.createdById === userId;
    const canManage = await this.canManageSession(sessionId, userId);

    return {
      ...row.session,
      isCreator,
      canManage,
      currentUserId: userId,
      template: sessionTemplate,
      team: row.team ?? { id: row.session.teamId, name: 'Unknown Team' },
      createdBy: row.createdBy ?? {
        id: row.session.createdById,
        name: 'Unknown',
        image: null,
      },
      participants,
      deck,
      currentPrompt,
      pendingCount,
    };
  }

  // ==========================================================================
  // Create
  // ==========================================================================

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

    const id = generateId();
    const now = new Date();
    const seed = generateSeed();
    const selectionMode =
      data.selectionMode ?? ICEBREAKER_SELECTION_MODES.Ordered;
    const templateId = data.templateId ?? null;
    const flavourFilter = data.flavourFilter ?? null;

    const candidates = await this.collectDeckCandidates({
      templateId,
      flavourFilter,
    });

    if (candidates.length === 0) {
      throw new BadRequestException(
        'No prompts available to build the icebreaker deck',
      );
    }

    // Build the seed-ordered deck up front so the session opens straight into
    // the Curating phase — no separate "start" step.
    const isRandom =
      selectionMode === ICEBREAKER_SELECTION_MODES.Random || !templateId;
    const ordered = isRandom ? seededShuffle(candidates, seed) : candidates;
    const deck = ordered.slice(0, MAX_DECK_SIZE);

    await this.database.insert(icebreakersSchema.icebreakerSession).values({
      id,
      name: data.name,
      teamId: data.teamId,
      createdById: userId,
      status: ICEBREAKER_SESSION_STATUSES.Curating,
      templateId,
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

  // ==========================================================================
  // Gateway helpers / participants
  // ==========================================================================

  async isSessionCreator(sessionId: string, userId: string): Promise<boolean> {
    const [session] = await this.database
      .select({ createdById: icebreakersSchema.icebreakerSession.createdById })
      .from(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    return session?.createdById === userId;
  }

  async upsertParticipant(
    sessionId: string,
    userId: string,
    isOnline: boolean,
  ): Promise<void> {
    const [existing] = await this.database
      .select({ id: icebreakersSchema.icebreakerParticipant.id })
      .from(icebreakersSchema.icebreakerParticipant)
      .where(
        and(
          eq(icebreakersSchema.icebreakerParticipant.sessionId, sessionId),
          eq(icebreakersSchema.icebreakerParticipant.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.database
        .update(icebreakersSchema.icebreakerParticipant)
        .set({ isOnline })
        .where(eq(icebreakersSchema.icebreakerParticipant.id, existing.id));
    } else {
      await this.database
        .insert(icebreakersSchema.icebreakerParticipant)
        .values({ id: generateId(), sessionId, userId, isOnline });
    }
  }

  async getParticipant(
    sessionId: string,
    userId: string,
  ): Promise<icebreakersSchema.IcebreakerParticipant | undefined> {
    const [participant] = await this.database
      .select()
      .from(icebreakersSchema.icebreakerParticipant)
      .where(
        and(
          eq(icebreakersSchema.icebreakerParticipant.sessionId, sessionId),
          eq(icebreakersSchema.icebreakerParticipant.userId, userId),
        ),
      )
      .limit(1);

    return participant;
  }

  // ==========================================================================
  // Deck lifecycle (facilitator curates deck)
  // ==========================================================================

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

  /**
   * Facilitator commits a decision on a SPECIFIC deck card (the one currently
   * shown — the host browses freely by swiping, then Skip/Select acts on the
   * card on screen). Keep → present it (Presenting); Skip → mark it skipped and
   * stay in Curating.
   */
  async swipePrompt(
    sessionId: string,
    userId: string,
    decision: TIcebreakerPromptDecision,
    sessionPromptId: string,
  ): Promise<void> {
    const session = await this.assertCanManage(sessionId, userId);

    if (session.status !== ICEBREAKER_SESSION_STATUSES.Curating) {
      throw new BadRequestException(
        'Prompts can only be decided while curating the deck',
      );
    }

    const [card] = await this.database
      .select({
        id: icebreakersSchema.icebreakerSessionPrompt.id,
        decision: icebreakersSchema.icebreakerSessionPrompt.decision,
      })
      .from(icebreakersSchema.icebreakerSessionPrompt)
      .where(
        and(
          eq(icebreakersSchema.icebreakerSessionPrompt.id, sessionPromptId),
          eq(icebreakersSchema.icebreakerSessionPrompt.sessionId, sessionId),
        ),
      )
      .limit(1);

    if (!card) {
      throw new NotFoundException('Prompt not found in this session');
    }
    if (card.decision !== ICEBREAKER_PROMPT_DECISIONS.Pending) {
      throw new BadRequestException('This prompt has already been decided');
    }

    const now = new Date();

    if (decision === ICEBREAKER_PROMPT_DECISIONS.Kept) {
      await this.database
        .update(icebreakersSchema.icebreakerSessionPrompt)
        .set({
          decision: ICEBREAKER_PROMPT_DECISIONS.Kept,
          presentedAt: now,
          updatedAt: now,
        })
        .where(eq(icebreakersSchema.icebreakerSessionPrompt.id, card.id));

      await this.database
        .update(icebreakersSchema.icebreakerSession)
        .set({
          status: ICEBREAKER_SESSION_STATUSES.Presenting,
          currentPromptId: card.id,
          updatedAt: now,
        })
        .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
      return;
    }

    // Skipped
    await this.database
      .update(icebreakersSchema.icebreakerSessionPrompt)
      .set({ decision: ICEBREAKER_PROMPT_DECISIONS.Skipped, updatedAt: now })
      .where(eq(icebreakersSchema.icebreakerSessionPrompt.id, card.id));

    await this.database
      .update(icebreakersSchema.icebreakerSession)
      .set({ updatedAt: now })
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
  }

  /**
   * After a presented prompt has been answered aloud, move back to curating the
   * next pending card (→ Curating) or finish the session (→ Completed) if the
   * deck is dry.
   */
  async advancePrompt(sessionId: string, userId: string): Promise<void> {
    await this.assertCanManage(sessionId, userId);

    const nextCard = await this.getCurrentPendingPrompt(sessionId);
    const now = new Date();

    if (nextCard) {
      await this.database
        .update(icebreakersSchema.icebreakerSession)
        .set({
          status: ICEBREAKER_SESSION_STATUSES.Curating,
          currentPromptId: null,
          updatedAt: now,
        })
        .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
    } else {
      await this.database
        .update(icebreakersSchema.icebreakerSession)
        .set({
          status: ICEBREAKER_SESSION_STATUSES.Completed,
          currentPromptId: null,
          timerEndsAt: null,
          updatedAt: now,
        })
        .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
    }
  }

  // ==========================================================================
  // Misc mutations
  // ==========================================================================

  async startTimer(
    sessionId: string,
    userId: string,
    duration: number,
  ): Promise<Date> {
    await this.assertCanManage(sessionId, userId);

    const timerEndsAt = new Date(Date.now() + duration * 1000);

    await this.database
      .update(icebreakersSchema.icebreakerSession)
      .set({ timerDuration: duration, timerEndsAt, updatedAt: new Date() })
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));

    return timerEndsAt;
  }

  async updateSessionName(
    sessionId: string,
    name: string,
  ): Promise<IcebreakerSession> {
    const [existing] = await this.database
      .select()
      .from(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!existing) throw new NotFoundException('Session not found');

    const [updated] = await this.database
      .update(icebreakersSchema.icebreakerSession)
      .set({ name, updatedAt: new Date() })
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .returning();

    return updated;
  }

  async endSession(sessionId: string, userId: string): Promise<void> {
    await this.assertCanManage(sessionId, userId);

    await this.database
      .update(icebreakersSchema.icebreakerSession)
      .set({
        status: ICEBREAKER_SESSION_STATUSES.Completed,
        currentPromptId: null,
        timerEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const canManage = await this.canManageSession(sessionId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'You do not have permission to delete this session',
      );
    }

    await this.database
      .delete(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
  }

  // ==========================================================================
  // History
  // ==========================================================================

  async getHistory(
    userId: string,
    page = 1,
    limit = 15,
    teamId?: string,
    search?: string,
  ): Promise<{
    sessions: {
      id: string;
      name: string;
      teamId: string;
      teamName: string | null;
      teamEmoji: string | null;
      orgId: string | null;
      orgName: string | null;
      participantCount: number;
      promptCount: number;
      keptCount: number;
      updatedAt: Date;
      createdAt: Date;
      canDelete: boolean;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const normalizedSearch = search?.trim();

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const isAdmin =
      fullUser?.role === USER_ROLES.SuperAdmin ||
      fullUser?.role === USER_ROLES.SystemAdmin;

    let allUserTeamMemberships: { teamId: string; tag: string }[] = [];
    let allowedTeamIds: string[] | null = null;
    if (!isAdmin) {
      allUserTeamMemberships = await this.database
        .select({
          teamId: teamSchema.teamMember.teamId,
          tag: teamSchema.teamMember.tag,
        })
        .from(teamSchema.teamMember)
        .where(eq(teamSchema.teamMember.userId, userId));
      allowedTeamIds = allUserTeamMemberships.map((m) => m.teamId);
      if (allowedTeamIds.length === 0) {
        return { sessions: [], total: 0, page, limit };
      }
    }

    let adminOrgIds = new Set<string>();
    let leadTeamIds = new Set<string>();
    if (!isAdmin) {
      const orgMemberships = await this.database
        .select({
          organizationId: orgSchema.organizationMember.organizationId,
          role: orgSchema.organizationMember.role,
        })
        .from(orgSchema.organizationMember)
        .where(eq(orgSchema.organizationMember.userId, userId));

      adminOrgIds = new Set(
        orgMemberships
          .filter(
            (m) =>
              m.role === ORG_MEMBER_ROLES.Owner ||
              m.role === ORG_MEMBER_ROLES.Admin,
          )
          .map((m) => m.organizationId),
      );

      leadTeamIds = new Set(
        allUserTeamMemberships
          .filter((m) => m.tag === TEAM_MEMBER_TAGS.Lead)
          .map((m) => m.teamId),
      );
    }

    const conditions: SQL[] = [
      eq(
        icebreakersSchema.icebreakerSession.status,
        ICEBREAKER_SESSION_STATUSES.Completed,
      ),
    ];
    if (teamId)
      conditions.push(eq(icebreakersSchema.icebreakerSession.teamId, teamId));
    if (allowedTeamIds) {
      conditions.push(
        inArray(icebreakersSchema.icebreakerSession.teamId, allowedTeamIds),
      );
    }
    if (normalizedSearch) {
      conditions.push(
        or(
          ilike(
            icebreakersSchema.icebreakerSession.name,
            `%${normalizedSearch}%`,
          ),
          ilike(teamSchema.team.name, `%${normalizedSearch}%`),
          ilike(orgSchema.organization.name, `%${normalizedSearch}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [totalRow] = await this.database
      .select({ total: count() })
      .from(icebreakersSchema.icebreakerSession)
      .leftJoin(
        teamSchema.team,
        eq(icebreakersSchema.icebreakerSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(whereClause);

    const rows = await this.database
      .select({
        id: icebreakersSchema.icebreakerSession.id,
        name: icebreakersSchema.icebreakerSession.name,
        teamId: icebreakersSchema.icebreakerSession.teamId,
        teamName: teamSchema.team.name,
        teamEmoji: teamSchema.team.emoji,
        orgId: teamSchema.team.organizationId,
        orgName: orgSchema.organization.name,
        updatedAt: icebreakersSchema.icebreakerSession.updatedAt,
        createdAt: icebreakersSchema.icebreakerSession.createdAt,
      })
      .from(icebreakersSchema.icebreakerSession)
      .leftJoin(
        teamSchema.team,
        eq(icebreakersSchema.icebreakerSession.teamId, teamSchema.team.id),
      )
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(whereClause)
      .orderBy(desc(icebreakersSchema.icebreakerSession.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const sessions = await Promise.all(
      rows.map(async (row) => {
        const [pc] = await this.database
          .select({ total: count() })
          .from(icebreakersSchema.icebreakerParticipant)
          .where(eq(icebreakersSchema.icebreakerParticipant.sessionId, row.id));

        const [promptCountRow] = await this.database
          .select({ total: count() })
          .from(icebreakersSchema.icebreakerSessionPrompt)
          .where(
            eq(icebreakersSchema.icebreakerSessionPrompt.sessionId, row.id),
          );

        const [keptCountRow] = await this.database
          .select({ total: count() })
          .from(icebreakersSchema.icebreakerSessionPrompt)
          .where(
            and(
              eq(icebreakersSchema.icebreakerSessionPrompt.sessionId, row.id),
              eq(
                icebreakersSchema.icebreakerSessionPrompt.decision,
                ICEBREAKER_PROMPT_DECISIONS.Kept,
              ),
            ),
          );

        const canDelete =
          isAdmin ||
          (row.orgId !== null && adminOrgIds.has(row.orgId)) ||
          leadTeamIds.has(row.teamId);

        return {
          ...row,
          participantCount: pc?.total ?? 0,
          promptCount: promptCountRow?.total ?? 0,
          keptCount: keptCountRow?.total ?? 0,
          canDelete,
        };
      }),
    );

    return { sessions, total: totalRow?.total ?? 0, page, limit };
  }
}
