import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc } from 'drizzle-orm';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import {
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_PROMPT_DECISIONS,
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  type TIcebreakerPromptDecision,
} from '../common/enums';
import type { IcebreakerSession, IcebreakerSessionPrompt } from './schema';

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

  /**
   * Whether the user belongs to the session's team. The WebSocket join handler
   * calls this before joining a room — handshake auth only proves identity, not
   * membership, so without this any authenticated socket could join any session
   * by ID (SECURITY-ASSESSMENT F2). Unlike `canManageSession`, this returns true
   * for plain members, not just leads/admins.
   */
  async isSessionMember(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSessionRecord(sessionId);

    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, session.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return Boolean(membership);
  }

  /**
   * Returns the standup day a session is attached to, if any. Used by the
   * controller to refresh the standup room feed after a session mutation.
   */
  async getStandupLink(
    sessionId: string,
  ): Promise<{ standupId: string; entryDate: string } | null> {
    const [row] = await this.database
      .select({
        standupId: icebreakersSchema.icebreakerSession.standupId,
        entryDate: icebreakersSchema.icebreakerSession.entryDate,
      })
      .from(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId))
      .limit(1);

    if (!row?.standupId || !row.entryDate) return null;
    return { standupId: row.standupId, entryDate: row.entryDate };
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
   * Advance to the next pending prompt, or finish the session when the deck is
   * exhausted. Icebreaker sessions are intentionally not persisted past their
   * run (they carry no durable value), so "finish" hard-deletes the session
   * rather than marking it completed — nothing lingers in history. Returns
   * whether the session ended so the caller can remove the Convex projection
   * instead of re-syncing it.
   */
  async advancePrompt(
    sessionId: string,
    userId: string,
  ): Promise<{ ended: boolean }> {
    await this.assertCanManage(sessionId, userId);

    const nextCard = await this.getCurrentPendingPrompt(sessionId);

    if (nextCard) {
      await this.database
        .update(icebreakersSchema.icebreakerSession)
        .set({
          status: ICEBREAKER_SESSION_STATUSES.Curating,
          currentPromptId: null,
          updatedAt: new Date(),
        })
        .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
      return { ended: false };
    }

    // Deck exhausted → session is over. Hard-delete (cascades prompts and
    // participants) so it never enters history.
    await this.database
      .delete(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
    return { ended: true };
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

  /**
   * End a session. Icebreaker sessions carry no durable value, so ending one
   * hard-deletes it (cascading to prompts and participants) rather than marking
   * it completed — it never appears in history. The caller removes the Convex
   * projection afterwards.
   */
  async endSession(sessionId: string, userId: string): Promise<void> {
    await this.assertCanManage(sessionId, userId);

    await this.database
      .delete(icebreakersSchema.icebreakerSession)
      .where(eq(icebreakersSchema.icebreakerSession.id, sessionId));
  }
}
