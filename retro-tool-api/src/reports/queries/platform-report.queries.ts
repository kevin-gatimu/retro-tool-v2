import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  isNotNull,
  lte,
  sql,
} from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as retroSchema from '../../retros/schema';
import * as teamSchema from '../../teams/schema';
import * as orgSchema from '../../organizations/schema';
import * as authSchema from '../../auth/schema';
import * as estimateSchema from '../../estimates/schema';
import * as standupSchema from '../../standups/schema';
import * as surveySchema from '../../surveys/schema';
import * as pollSchema from '../../polls/schema';
import * as icebreakerSchema from '../../icebreakers/schema';
import { RETRO_STATUSES, USER_STATUSES } from '../../common/enums';
import type { ActivityPoint, PlatformReport } from '../types';
import type { ResolvedRange } from '../dto';
import { bucketExpr, fillSeries } from './shared';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof orgSchema &
    typeof authSchema &
    typeof estimateSchema &
    typeof standupSchema &
    typeof surveySchema &
    typeof pollSchema &
    typeof icebreakerSchema
>;

const { retrospective } = retroSchema;
const { team } = teamSchema;
const { organization } = orgSchema;
const { user, session } = authSchema;
const { storyEstimateSession } = estimateSchema;
const { standup } = standupSchema;
const { survey } = surveySchema;
const { poll } = pollSchema;
const { icebreakerSession } = icebreakerSchema;

const DAY_MS = 86400000;

function emptyActivityPoint(bucketKey: string): ActivityPoint {
  return {
    bucket: bucketKey,
    retros: 0,
    storyEstimateSessions: 0,
    standups: 0,
    surveys: 0,
    polls: 0,
    icebreakerSessions: 0,
  };
}

export async function buildPlatformReport(
  db: Database,
  range: ResolvedRange,
): Promise<PlatformReport> {
  const { from, to, bucket } = range;
  const now = new Date();
  const inRange = (column: AnyColumn) =>
    and(gte(column, from), lte(column, to));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const [
    [userCounts],
    [active7Row],
    [active30Row],
    [orgCountRow],
    [teamCountRow],
  ] = await Promise.all([
    db
      .select({
        total: count(),
        pending: count(
          sql`case when ${user.status} = ${USER_STATUSES.Pending} then 1 end`,
        ),
      })
      .from(user),
    db
      .select({ value: countDistinct(session.userId) })
      .from(session)
      .where(gte(session.updatedAt, new Date(now.getTime() - 7 * DAY_MS))),
    db
      .select({ value: countDistinct(session.userId) })
      .from(session)
      .where(gte(session.updatedAt, new Date(now.getTime() - 30 * DAY_MS))),
    db.select({ value: count() }).from(organization),
    db.select({ value: count() }).from(team),
  ]);

  // ── User growth + status funnel ────────────────────────────────────────────
  const growthRows = await db
    .select({ bucket: bucketExpr(bucket, user.createdAt), value: count() })
    .from(user)
    .where(inRange(user.createdAt))
    .groupBy(bucketExpr(bucket, user.createdAt));
  const userGrowth = fillSeries(
    from,
    to,
    bucket,
    growthRows.map((row) => ({
      bucket: row.bucket,
      signups: Number(row.value),
    })),
    (bucketKey) => ({ bucket: bucketKey, signups: 0 }),
  );

  const funnelRows = await db
    .select({ status: user.status, value: count() })
    .from(user)
    .groupBy(user.status);
  const statusFunnel = funnelRows.map((row) => ({
    status: row.status,
    count: Number(row.value),
  }));

  // ── Feature-adoption activity series (one grouped count per feature) ──────
  const [
    retroRows,
    estimateRows,
    standupRows,
    surveyRows,
    pollRows,
    icebreakerRows,
  ] = await Promise.all([
    db
      .select({
        bucket: bucketExpr(bucket, retrospective.completedAt),
        value: count(),
      })
      .from(retrospective)
      .where(
        and(
          eq(retrospective.status, RETRO_STATUSES.Completed),
          isNotNull(retrospective.completedAt),
          gte(retrospective.completedAt, from),
          lte(retrospective.completedAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, retrospective.completedAt)),
    db
      .select({
        bucket: bucketExpr(bucket, storyEstimateSession.createdAt),
        value: count(),
      })
      .from(storyEstimateSession)
      .where(inRange(storyEstimateSession.createdAt))
      .groupBy(bucketExpr(bucket, storyEstimateSession.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, standup.createdAt),
        value: count(),
      })
      .from(standup)
      .where(inRange(standup.createdAt))
      .groupBy(bucketExpr(bucket, standup.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, survey.createdAt),
        value: count(),
      })
      .from(survey)
      .where(inRange(survey.createdAt))
      .groupBy(bucketExpr(bucket, survey.createdAt)),
    db
      .select({ bucket: bucketExpr(bucket, poll.createdAt), value: count() })
      .from(poll)
      .where(inRange(poll.createdAt))
      .groupBy(bucketExpr(bucket, poll.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, icebreakerSession.createdAt),
        value: count(),
      })
      .from(icebreakerSession)
      .where(inRange(icebreakerSession.createdAt))
      .groupBy(bucketExpr(bucket, icebreakerSession.createdAt)),
  ]);

  const activityMap = new Map<string, ActivityPoint>();
  const applyRows = (
    rows: Array<{ bucket: string; value: number }>,
    key: keyof Omit<ActivityPoint, 'bucket'>,
  ) => {
    for (const row of rows) {
      const entry =
        activityMap.get(row.bucket) ?? emptyActivityPoint(row.bucket);
      entry[key] = Number(row.value);
      activityMap.set(row.bucket, entry);
    }
  };
  applyRows(retroRows, 'retros');
  applyRows(estimateRows, 'storyEstimateSessions');
  applyRows(standupRows, 'standups');
  applyRows(surveyRows, 'surveys');
  applyRows(pollRows, 'polls');
  applyRows(icebreakerRows, 'icebreakerSessions');
  const activity = fillSeries(
    from,
    to,
    bucket,
    [...activityMap.values()],
    emptyActivityPoint,
  );

  // Org league moved to the paginated /platform/organizations endpoint.

  return {
    range: range.asRange,
    kpis: {
      totalUsers: Number(userCounts?.total ?? 0),
      pendingUsers: Number(userCounts?.pending ?? 0),
      activeUsers7d: Number(active7Row?.value ?? 0),
      activeUsers30d: Number(active30Row?.value ?? 0),
      organizations: Number(orgCountRow?.value ?? 0),
      teams: Number(teamCountRow?.value ?? 0),
    },
    userGrowth,
    statusFunnel,
    activity,
  };
}
