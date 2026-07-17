import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  max,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as retroSchema from '../../retros/schema';
import * as teamSchema from '../../teams/schema';
import * as orgSchema from '../../organizations/schema';
import { RETRO_STATUSES } from '../../common/enums';
import type { OrgReport } from '../types';
import type { ResolvedRange } from '../dto';
import { bucketExpr, fillSeries } from './shared';

type Database = NodePgDatabase<
  typeof retroSchema & typeof teamSchema & typeof orgSchema
>;

const { retrospective, template } = retroSchema;
const { team } = teamSchema;
const { organization, organizationMember } = orgSchema;

const AT_RISK_DAYS = 30;

export async function buildOrgReport(
  db: Database,
  orgId: string,
  range: ResolvedRange,
): Promise<OrgReport> {
  const { from, to, bucket } = range;

  const completedInRange = and(
    eq(team.organizationId, orgId),
    eq(retrospective.status, RETRO_STATUSES.Completed),
    isNotNull(retrospective.completedAt),
    gte(retrospective.completedAt, from),
    lte(retrospective.completedAt, to),
  );

  const [
    [orgRow],
    [teamCountRow],
    [memberCountRow],
    [retroKpisRow],
    memberGrowthRows,
    teamGrowthRows,
  ] = await Promise.all([
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1),
    db
      .select({ value: count() })
      .from(team)
      .where(eq(team.organizationId, orgId)),
    db
      .select({ value: count() })
      .from(organizationMember)
      .where(eq(organizationMember.organizationId, orgId)),
    db
      .select({
        retros: count(),
        activeTeams: countDistinct(retrospective.teamId),
      })
      .from(retrospective)
      .innerJoin(team, eq(retrospective.teamId, team.id))
      .where(completedInRange),
    db
      .select({
        bucket: bucketExpr(bucket, organizationMember.createdAt),
        value: count(),
      })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, orgId),
          gte(organizationMember.createdAt, from),
          lte(organizationMember.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, organizationMember.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, team.createdAt),
        value: count(),
      })
      .from(team)
      .where(
        and(
          eq(team.organizationId, orgId),
          gte(team.createdAt, from),
          lte(team.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, team.createdAt)),
  ]);

  const growthMap = new Map<string, { members: number; teams: number }>();
  for (const row of memberGrowthRows) {
    growthMap.set(row.bucket, { members: Number(row.value), teams: 0 });
  }
  for (const row of teamGrowthRows) {
    const entry = growthMap.get(row.bucket) ?? { members: 0, teams: 0 };
    entry.teams = Number(row.value);
    growthMap.set(row.bucket, entry);
  }
  const growth = fillSeries(
    from,
    to,
    bucket,
    [...growthMap.entries()].map(([bucketKey, values]) => ({
      bucket: bucketKey,
      ...values,
    })),
    (bucketKey) => ({ bucket: bucketKey, members: 0, teams: 0 }),
  );

  // ── Retro cadence heat: retros per team × bucket (team league moved to the
  //    paginated /organizations/:orgId/teams endpoint) ──────────────────────
  const cadenceRows = await db
    .select({
      teamId: retrospective.teamId,
      teamName: team.name,
      bucket: bucketExpr(bucket, retrospective.completedAt),
      retros: count(),
    })
    .from(retrospective)
    .innerJoin(team, eq(retrospective.teamId, team.id))
    .where(completedInRange)
    .groupBy(
      retrospective.teamId,
      team.name,
      bucketExpr(bucket, retrospective.completedAt),
    );
  const cadenceHeat = cadenceRows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    bucket: row.bucket,
    retros: Number(row.retros),
  }));

  // ── Template usage across the range ────────────────────────────────────────
  const templateRows = await db
    .select({ template: template.name, value: count() })
    .from(retrospective)
    .innerJoin(team, eq(retrospective.teamId, team.id))
    .innerJoin(template, eq(retrospective.templateId, template.id))
    .where(completedInRange)
    .groupBy(template.name)
    .orderBy(desc(count()));
  const templateUsage = templateRows.map((row) => ({
    template: row.template,
    count: Number(row.value),
  }));

  // ── Teams at risk: no completed retro in the last AT_RISK_DAYS ────────────
  const lastRetroRows = await db
    .select({
      teamId: team.id,
      name: team.name,
      lastCompletedRetroAt: max(retrospective.completedAt),
    })
    .from(team)
    .leftJoin(
      retrospective,
      and(
        eq(retrospective.teamId, team.id),
        eq(retrospective.status, RETRO_STATUSES.Completed),
      ),
    )
    .where(eq(team.organizationId, orgId))
    .groupBy(team.id, team.name);

  const now = Date.now();
  const atRiskTeams = lastRetroRows
    .map((row) => {
      const last = row.lastCompletedRetroAt
        ? new Date(row.lastCompletedRetroAt)
        : null;
      const days = last ? Math.floor((now - last.getTime()) / 86400000) : null;
      return {
        teamId: row.teamId,
        name: row.name,
        lastCompletedRetroAt: last ? last.toISOString() : null,
        daysSinceLastRetro: days,
      };
    })
    .filter(
      (row) =>
        row.daysSinceLastRetro === null ||
        row.daysSinceLastRetro > AT_RISK_DAYS,
    )
    .sort(
      (a, b) =>
        (b.daysSinceLastRetro ?? Number.MAX_SAFE_INTEGER) -
        (a.daysSinceLastRetro ?? Number.MAX_SAFE_INTEGER),
    );

  return {
    range: range.asRange,
    orgId,
    orgName: orgRow?.name ?? 'Unknown organization',
    kpis: {
      teams: Number(teamCountRow?.value ?? 0),
      members: Number(memberCountRow?.value ?? 0),
      retrosInRange: Number(retroKpisRow?.retros ?? 0),
      activeTeamsInRange: Number(retroKpisRow?.activeTeams ?? 0),
    },
    growth,
    cadenceHeat,
    templateUsage,
    atRiskTeams,
  };
}
