import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as retroSchema from '../../retros/schema';
import * as teamSchema from '../../teams/schema';
import * as orgSchema from '../../organizations/schema';
import * as authSchema from '../../auth/schema';
import { RETRO_STATUSES } from '../../common/enums';
import type {
  OrgLeagueRow,
  OrgTeamLeagueRow,
  Paginated,
  TeamMemberBreakdownRow,
} from '../types';
import type { LeagueQueryDto, ResolvedRange } from '../dto';
import { ratio } from './shared';

type Database = NodePgDatabase<
  typeof retroSchema & typeof teamSchema & typeof orgSchema & typeof authSchema
>;

const { card, vote, retrospective, retroParticipant } = retroSchema;
const { team, teamMember } = teamSchema;
const { organization, organizationMember } = orgSchema;
const { user } = authSchema;

function offsetOf(query: LeagueQueryDto): number {
  return (query.page - 1) * query.pageSize;
}

/**
 * Paginated per-member breakdown for a team (lead-only endpoint).
 * The member page is selected in SQL; stats are then batched over the
 * page's user ids — bounded by pageSize ≤ 100.
 */
export async function buildTeamMembersLeague(
  db: Database,
  teamId: string,
  range: ResolvedRange,
  query: LeagueQueryDto,
): Promise<Paginated<TeamMemberBreakdownRow>> {
  const { from, to } = range;

  const searchFilter = query.search
    ? ilike(user.name, `%${query.search}%`)
    : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(and(eq(teamMember.teamId, teamId), searchFilter));

  const memberRows = await db
    .select({ userId: teamMember.userId, name: user.name })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(and(eq(teamMember.teamId, teamId), searchFilter))
    .orderBy(user.name)
    .limit(query.pageSize)
    .offset(offsetOf(query));

  const userIds = memberRows.map((row) => row.userId);
  if (userIds.length === 0) {
    return {
      rows: [],
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalRow?.value ?? 0),
    };
  }

  const retroIdsRows = await db
    .select({ id: retrospective.id })
    .from(retrospective)
    .where(
      and(
        eq(retrospective.teamId, teamId),
        eq(retrospective.status, RETRO_STATUSES.Completed),
        isNotNull(retrospective.completedAt),
        gte(retrospective.completedAt, from),
        lte(retrospective.completedAt, to),
      ),
    );
  const retroIds = retroIdsRows.map((row) => row.id);

  const empty = Promise.resolve(
    [] as Array<{ userId: string | null; value: number }>,
  );
  const [cardRows, voteRows, attendRows] = await Promise.all([
    retroIds.length
      ? db
          .select({ userId: card.authorId, value: count() })
          .from(card)
          .where(
            and(
              inArray(card.retroId, retroIds),
              inArray(card.authorId, userIds),
            ),
          )
          .groupBy(card.authorId)
      : empty,
    retroIds.length
      ? db
          .select({ userId: vote.userId, value: count() })
          .from(vote)
          .innerJoin(card, eq(vote.cardId, card.id))
          .where(
            and(inArray(card.retroId, retroIds), inArray(vote.userId, userIds)),
          )
          .groupBy(vote.userId)
      : empty,
    retroIds.length
      ? db
          .select({ userId: retroParticipant.userId, value: count() })
          .from(retroParticipant)
          .where(
            and(
              inArray(retroParticipant.retroId, retroIds),
              inArray(retroParticipant.userId, userIds),
            ),
          )
          .groupBy(retroParticipant.userId)
      : empty,
  ]);

  const cardsBy = new Map(cardRows.map((r) => [r.userId, Number(r.value)]));
  const votesBy = new Map(voteRows.map((r) => [r.userId, Number(r.value)]));
  const attendedBy = new Map(
    attendRows.map((r) => [r.userId, Number(r.value)]),
  );

  return {
    rows: memberRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      cardsAuthored: cardsBy.get(row.userId) ?? 0,
      votesCast: votesBy.get(row.userId) ?? 0,
      retrosAttended: attendedBy.get(row.userId) ?? 0,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.value ?? 0),
  };
}

/** Paginated team league for an organization. */
export async function buildOrgTeamsLeague(
  db: Database,
  orgId: string,
  range: ResolvedRange,
  query: LeagueQueryDto,
): Promise<Paginated<OrgTeamLeagueRow>> {
  const { from, to } = range;
  const searchFilter = query.search
    ? ilike(team.name, `%${query.search}%`)
    : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(team)
    .where(and(eq(team.organizationId, orgId), searchFilter));

  const teamRows = await db
    .select({ teamId: team.id, name: team.name })
    .from(team)
    .where(and(eq(team.organizationId, orgId), searchFilter))
    .orderBy(team.name)
    .limit(query.pageSize)
    .offset(offsetOf(query));

  const teamIds = teamRows.map((row) => row.teamId);
  if (teamIds.length === 0) {
    return {
      rows: [],
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalRow?.value ?? 0),
    };
  }

  const completedInRange = and(
    inArray(retrospective.teamId, teamIds),
    eq(retrospective.status, RETRO_STATUSES.Completed),
    isNotNull(retrospective.completedAt),
    gte(retrospective.completedAt, from),
    lte(retrospective.completedAt, to),
  );

  const [memberRows, retroRows, attendanceRows] = await Promise.all([
    db
      .select({ teamId: teamMember.teamId, value: count() })
      .from(teamMember)
      .where(inArray(teamMember.teamId, teamIds))
      .groupBy(teamMember.teamId),
    db
      .select({ teamId: retrospective.teamId, value: count() })
      .from(retrospective)
      .where(completedInRange)
      .groupBy(retrospective.teamId),
    db
      .select({
        teamId: retrospective.teamId,
        attendances: count(retroParticipant.id),
        retros: countDistinct(retrospective.id),
      })
      .from(retrospective)
      .leftJoin(
        retroParticipant,
        eq(retroParticipant.retroId, retrospective.id),
      )
      .where(completedInRange)
      .groupBy(retrospective.teamId),
  ]);

  const membersBy = new Map(memberRows.map((r) => [r.teamId, Number(r.value)]));
  const retrosBy = new Map(retroRows.map((r) => [r.teamId, Number(r.value)]));
  const attendanceBy = new Map(
    attendanceRows.map((r) => [
      r.teamId,
      { attendances: Number(r.attendances), retros: Number(r.retros) },
    ]),
  );

  return {
    rows: teamRows.map((row) => {
      const members = membersBy.get(row.teamId) ?? 0;
      const att = attendanceBy.get(row.teamId);
      return {
        teamId: row.teamId,
        name: row.name,
        members,
        retrosInRange: retrosBy.get(row.teamId) ?? 0,
        attendanceRate: att
          ? ratio(att.attendances, att.retros * Math.max(members, 1))
          : 0,
      };
    }),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.value ?? 0),
  };
}

/** Paginated organization league for the platform dashboard. */
export async function buildPlatformOrgsLeague(
  db: Database,
  range: ResolvedRange,
  query: LeagueQueryDto,
): Promise<Paginated<OrgLeagueRow>> {
  const { from, to } = range;
  const searchFilter = query.search
    ? ilike(organization.name, `%${query.search}%`)
    : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(organization)
    .where(searchFilter);

  const orgRows = await db
    .select({ orgId: organization.id, name: organization.name })
    .from(organization)
    .where(searchFilter)
    .orderBy(organization.name)
    .limit(query.pageSize)
    .offset(offsetOf(query));

  const orgIds = orgRows.map((row) => row.orgId);
  if (orgIds.length === 0) {
    return {
      rows: [],
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalRow?.value ?? 0),
    };
  }

  const [memberRows, teamRows, retroRows] = await Promise.all([
    db
      .select({ orgId: organizationMember.organizationId, value: count() })
      .from(organizationMember)
      .where(inArray(organizationMember.organizationId, orgIds))
      .groupBy(organizationMember.organizationId),
    db
      .select({ orgId: team.organizationId, value: count() })
      .from(team)
      .where(inArray(team.organizationId, orgIds))
      .groupBy(team.organizationId),
    db
      .select({ orgId: team.organizationId, value: count() })
      .from(retrospective)
      .innerJoin(team, eq(retrospective.teamId, team.id))
      .where(
        and(
          inArray(team.organizationId, orgIds),
          eq(retrospective.status, RETRO_STATUSES.Completed),
          isNotNull(retrospective.completedAt),
          gte(retrospective.completedAt, from),
          lte(retrospective.completedAt, to),
        ),
      )
      .groupBy(team.organizationId),
  ]);

  const membersBy = new Map(memberRows.map((r) => [r.orgId, Number(r.value)]));
  const teamsBy = new Map(teamRows.map((r) => [r.orgId, Number(r.value)]));
  const retrosBy = new Map(retroRows.map((r) => [r.orgId, Number(r.value)]));

  return {
    rows: orgRows.map((row) => ({
      orgId: row.orgId,
      name: row.name,
      members: membersBy.get(row.orgId) ?? 0,
      teams: teamsBy.get(row.orgId) ?? 0,
      retrosInRange: retrosBy.get(row.orgId) ?? 0,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.value ?? 0),
  };
}
