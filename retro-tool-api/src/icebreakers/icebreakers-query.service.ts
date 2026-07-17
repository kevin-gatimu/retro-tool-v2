import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
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
import {
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_PROMPT_DECISIONS,
  USER_ROLES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
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
 * Read-heavy icebreaker list / detail / history queries. Split out of
 * IcebreakersService (which was ~1,050 lines) since the session aggregation
 * builders are a self-contained read concern; the mutating lifecycle and the
 * permission helpers stay in IcebreakersService, which this service reuses for
 * the `canManage` flag.
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
