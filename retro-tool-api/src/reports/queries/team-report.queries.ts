import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as retroSchema from '../../retros/schema';
import * as teamSchema from '../../teams/schema';
import * as estimateSchema from '../../estimates/schema';
import * as authSchema from '../../auth/schema';
import * as standupSchema from '../../standups/schema';
import { RETRO_STATUSES } from '../../common/enums';
import type {
  SentimentSlice,
  TeamMemberBreakdownRow,
  TeamReport,
  VoteHistogramBin,
} from '../types';
import type { ResolvedRange } from '../dto';
import { bucketExpr, fillSeries, ratio } from './shared';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof estimateSchema &
    typeof authSchema &
    typeof standupSchema
>;

const { card, vote, retrospective, retroParticipant, templateColumn } =
  retroSchema;
const { team, teamMember } = teamSchema;
const { storyEstimateRound, storyEstimateSession, storyEstimateVote } =
  estimateSchema;
const { user } = authSchema;
const { standup, standupEntry, standupSubmission } = standupSchema;

/** Retros of this team completed inside the range. */
function completedRetroFilter(teamId: string, from: Date, to: Date) {
  return and(
    eq(retrospective.teamId, teamId),
    eq(retrospective.status, RETRO_STATUSES.Completed),
    isNotNull(retrospective.completedAt),
    gte(retrospective.completedAt, from),
    lte(retrospective.completedAt, to),
  );
}

export async function buildTeamReport(
  db: Database,
  teamId: string,
  range: ResolvedRange,
  isLead: boolean,
): Promise<TeamReport> {
  const { from, to, bucket } = range;

  const [teamRow] = await db
    .select({ name: team.name })
    .from(team)
    .where(eq(team.id, teamId))
    .limit(1);

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(teamMember)
    .where(eq(teamMember.teamId, teamId));
  const memberCount = Number(memberCountRow?.value ?? 0);

  const retroIdsRows = await db
    .select({ id: retrospective.id })
    .from(retrospective)
    .where(completedRetroFilter(teamId, from, to));
  const retroIds = retroIdsRows.map((row) => row.id);
  const retrosCompleted = retroIds.length;

  // Degenerate-but-valid empty report for teams with no completed retros.
  const hasRetros = retrosCompleted > 0;

  // ── Attendance (true attendance via retroParticipant) ─────────────────────
  const attendanceRows = hasRetros
    ? await db
        .select({
          bucket: bucketExpr(bucket, retrospective.completedAt),
          retros: countDistinct(retrospective.id),
          attendances: count(retroParticipant.id),
        })
        .from(retrospective)
        .leftJoin(
          retroParticipant,
          eq(retroParticipant.retroId, retrospective.id),
        )
        .where(completedRetroFilter(teamId, from, to))
        .groupBy(bucketExpr(bucket, retrospective.completedAt))
    : [];

  const attendanceSeries = fillSeries(
    from,
    to,
    bucket,
    attendanceRows.map((row) => ({
      bucket: row.bucket,
      retros: Number(row.retros),
      attendanceRate: ratio(
        Number(row.attendances),
        Number(row.retros) * Math.max(memberCount, 1),
      ),
    })),
    (bucketKey) => ({ bucket: bucketKey, retros: 0, attendanceRate: 0 }),
  );
  const totalAttendances = attendanceRows.reduce(
    (sum, row) => sum + Number(row.attendances),
    0,
  );
  const attendanceRate = ratio(
    totalAttendances,
    retrosCompleted * Math.max(memberCount, 1),
  );

  // ── Cards: volume, sentiment mix, discussion coverage, vote histogram ─────
  let cardsTotal = 0;
  let discussedTotal = 0;
  let sentiment: SentimentSlice[] = [];
  let voteHistogram: VoteHistogramBin[] = [
    { votes: '0', cards: 0 },
    { votes: '1', cards: 0 },
    { votes: '2', cards: 0 },
    { votes: '3+', cards: 0 },
  ];

  if (hasRetros) {
    const [cardTotals] = await db
      .select({
        total: count(),
        discussed: count(sql`case when ${card.isDiscussed} = true then 1 end`),
      })
      .from(card)
      .where(inArray(card.retroId, retroIds));
    cardsTotal = Number(cardTotals?.total ?? 0);
    discussedTotal = Number(cardTotals?.discussed ?? 0);

    const sentimentRows = await db
      .select({ column: templateColumn.name, cards: count() })
      .from(card)
      .innerJoin(templateColumn, eq(card.columnId, templateColumn.id))
      .where(inArray(card.retroId, retroIds))
      .groupBy(templateColumn.name)
      .orderBy(desc(count()));
    sentiment = sentimentRows.map((row) => ({
      column: row.column,
      cards: Number(row.cards),
    }));

    // votes-per-card histogram, binned in SQL over a per-card subquery
    const perCard = db
      .select({
        cardId: card.id,
        voteCount: count(vote.id).as('vote_count'),
      })
      .from(card)
      .leftJoin(vote, eq(vote.cardId, card.id))
      .where(inArray(card.retroId, retroIds))
      .groupBy(card.id)
      .as('per_card');
    const histogramRows = await db
      .select({
        bin: sql<string>`case when ${perCard.voteCount} >= 3 then '3+' else ${perCard.voteCount}::text end`,
        cards: count(),
      })
      .from(perCard)
      .groupBy(
        sql`case when ${perCard.voteCount} >= 3 then '3+' else ${perCard.voteCount}::text end`,
      );
    const histogramMap = new Map(
      histogramRows.map((row) => [row.bin, Number(row.cards)]),
    );
    voteHistogram = voteHistogram.map((bin) => ({
      votes: bin.votes,
      cards: histogramMap.get(bin.votes) ?? 0,
    }));
  }

  // ── Story estimates: velocity, consensus, spread ───────────────────────────
  const revealedFilter = and(
    eq(storyEstimateSession.teamId, teamId),
    isNotNull(storyEstimateRound.revealedAt),
    gte(storyEstimateRound.revealedAt, from),
    lte(storyEstimateRound.revealedAt, to),
  );

  const velocityRows = await db
    .select({
      bucket: bucketExpr(bucket, storyEstimateRound.revealedAt),
      roundsRevealed: count(),
      roundsAgreed: count(
        sql`case when ${storyEstimateRound.agreedPoints} is not null then 1 end`,
      ),
    })
    .from(storyEstimateRound)
    .innerJoin(
      storyEstimateSession,
      eq(storyEstimateRound.sessionId, storyEstimateSession.id),
    )
    .where(revealedFilter)
    .groupBy(bucketExpr(bucket, storyEstimateRound.revealedAt));

  const estimateVelocity = fillSeries(
    from,
    to,
    bucket,
    velocityRows.map((row) => ({
      bucket: row.bucket,
      roundsRevealed: Number(row.roundsRevealed),
      roundsAgreed: Number(row.roundsAgreed),
    })),
    (bucketKey) => ({ bucket: bucketKey, roundsRevealed: 0, roundsAgreed: 0 }),
  );
  const roundsRevealed = estimateVelocity.reduce(
    (sum, p) => sum + p.roundsRevealed,
    0,
  );
  const roundsAgreed = estimateVelocity.reduce(
    (sum, p) => sum + p.roundsAgreed,
    0,
  );

  // average distinct vote values per revealed round (vote spread)
  const perRound = db
    .select({
      roundId: storyEstimateRound.id,
      distinctPoints: countDistinct(storyEstimateVote.points).as(
        'distinct_points',
      ),
    })
    .from(storyEstimateRound)
    .innerJoin(
      storyEstimateSession,
      eq(storyEstimateRound.sessionId, storyEstimateSession.id),
    )
    .leftJoin(
      storyEstimateVote,
      eq(storyEstimateVote.roundId, storyEstimateRound.id),
    )
    .where(revealedFilter)
    .groupBy(storyEstimateRound.id)
    .as('per_round');
  const [spreadRow] = await db
    .select({
      avgSpread: sql<string>`coalesce(avg(${perRound.distinctPoints}), 0)`,
    })
    .from(perRound);
  const voteSpreadAvg = Math.round(Number(spreadRow?.avgSpread ?? 0) * 10) / 10;

  // ── Standup submission rate (empty series if the team has no standups) ────
  const standupRows = await db
    .select({
      bucket: bucketExpr(bucket, standupEntry.entryDate),
      entries: countDistinct(standupEntry.id),
      submissions: count(standupSubmission.id),
    })
    .from(standupEntry)
    .innerJoin(standup, eq(standupEntry.standupId, standup.id))
    .leftJoin(standupSubmission, eq(standupSubmission.entryId, standupEntry.id))
    .where(
      and(
        eq(standup.teamId, teamId),
        gte(standupEntry.entryDate, from.toISOString().slice(0, 10)),
        lte(standupEntry.entryDate, to.toISOString().slice(0, 10)),
      ),
    )
    .groupBy(bucketExpr(bucket, standupEntry.entryDate));

  const standupSeries =
    standupRows.length === 0
      ? []
      : fillSeries(
          from,
          to,
          bucket,
          standupRows.map((row) => ({
            bucket: row.bucket,
            entries: Number(row.entries),
            submissionRate: ratio(
              Number(row.submissions),
              Number(row.entries) * Math.max(memberCount, 1),
            ),
          })),
          (bucketKey) => ({
            bucket: bucketKey,
            entries: 0,
            submissionRate: 0,
          }),
        );

  // ── Health score (attendance-corrected; consensus replaces completion) ────
  const participation = Math.min(100, attendanceRate);
  const engagement = Math.min(
    100,
    hasRetros && memberCount > 0
      ? (cardsTotal / retrosCompleted / memberCount) * 50 // 2 cards/member = 100
      : 0,
  );
  const consensus = ratio(roundsAgreed, roundsRevealed);
  const rangeDays = Math.max(1, (to.getTime() - from.getTime()) / 86400000);
  const frequency = Math.min(100, (retrosCompleted / (rangeDays / 30)) * 50); // 2/month = 100
  const score = Math.round(
    participation * 0.3 +
      engagement * 0.25 +
      consensus * 0.25 +
      frequency * 0.2,
  );

  // ── Lead-only per-member breakdown ─────────────────────────────────────────
  let memberBreakdown: TeamMemberBreakdownRow[] | undefined;
  if (isLead) {
    const memberRows = await db
      .select({
        userId: teamMember.userId,
        name: user.name,
        cardsAuthored: hasRetros
          ? count(sql`case when ${card.id} is not null then 1 end`)
          : count(sql`null`),
      })
      .from(teamMember)
      .innerJoin(user, eq(teamMember.userId, user.id))
      .leftJoin(
        card,
        hasRetros
          ? and(
              eq(card.authorId, teamMember.userId),
              inArray(card.retroId, retroIds),
            )
          : sql`false`,
      )
      .where(eq(teamMember.teamId, teamId))
      .groupBy(teamMember.userId, user.name);

    const [voteRows, attendRows] = await Promise.all([
      hasRetros
        ? db
            .select({ userId: vote.userId, value: count() })
            .from(vote)
            .innerJoin(card, eq(vote.cardId, card.id))
            .where(inArray(card.retroId, retroIds))
            .groupBy(vote.userId)
        : Promise.resolve<{ userId: string; value: number }[]>([]),
      hasRetros
        ? db
            .select({ userId: retroParticipant.userId, value: count() })
            .from(retroParticipant)
            .where(inArray(retroParticipant.retroId, retroIds))
            .groupBy(retroParticipant.userId)
        : Promise.resolve<{ userId: string; value: number }[]>([]),
    ]);

    const votesBy = new Map(voteRows.map((r) => [r.userId, Number(r.value)]));
    const attendedBy = new Map(
      attendRows.map((r) => [r.userId, Number(r.value)]),
    );

    memberBreakdown = memberRows
      .map((row) => ({
        userId: row.userId,
        name: row.name,
        cardsAuthored: Number(row.cardsAuthored),
        votesCast: votesBy.get(row.userId) ?? 0,
        retrosAttended: attendedBy.get(row.userId) ?? 0,
      }))
      .sort((a, b) => b.cardsAuthored - a.cardsAuthored);
  }

  return {
    range: range.asRange,
    teamId,
    teamName: teamRow?.name ?? 'Unknown team',
    isLead,
    kpis: {
      retrosCompleted,
      attendanceRate,
      cardsPerRetro: hasRetros
        ? Math.round((cardsTotal / retrosCompleted) * 10) / 10
        : 0,
      discussionCoverage: ratio(discussedTotal, cardsTotal),
      consensusRate: ratio(roundsAgreed, roundsRevealed),
    },
    health: {
      score,
      components: {
        participation: Math.round(participation),
        engagement: Math.round(engagement),
        consensus: Math.round(consensus),
        frequency: Math.round(frequency),
      },
      description:
        score >= 80
          ? 'Excellent team health'
          : score >= 60
            ? 'Good health, room to improve'
            : score >= 40
              ? 'Needs improvement'
              : 'Critical — action required',
    },
    attendanceSeries,
    sentiment,
    voteHistogram,
    estimateVelocity,
    standupSeries,
    voteSpreadAvg,
    ...(memberBreakdown ? { memberBreakdown } : {}),
  };
}
