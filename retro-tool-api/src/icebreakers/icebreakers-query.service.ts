import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, asc } from 'drizzle-orm';
import * as icebreakersSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import {
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_PROMPT_DECISIONS,
} from '../common/enums';
import type {
  DeckPromptView,
  SessionDetail,
  SessionSummary,
  SessionTemplate,
} from './types/index';
import { IcebreakersService } from './icebreakers.service';

type Database = NodePgDatabase<
  typeof icebreakersSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

/**
 * Read-heavy icebreaker list / detail queries. Split out of IcebreakersService
 * (which was ~1,050 lines) since the session aggregation builders are a
 * self-contained read concern; the mutating lifecycle and the permission
 * helpers stay in IcebreakersService, which this service reuses for the
 * `canManage` flag. Icebreakers are ephemeral (ended sessions are deleted), so
 * there is no history/archive query here.
 */
@Injectable()
export class IcebreakersQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly icebreakersService: IcebreakersService,
  ) {}

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
    const canManage = await this.icebreakersService.canManageSession(
      sessionId,
      userId,
    );

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
}
