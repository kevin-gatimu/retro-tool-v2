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
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as retroSchema from '../../retros/schema';
import * as teamSchema from '../../teams/schema';
import * as estimateSchema from '../../estimates/schema';
import * as authSchema from '../../auth/schema';
import * as pollSchema from '../../polls/schema';
import * as surveySchema from '../../surveys/schema';
import { RETRO_STATUSES } from '../../common/enums';
import type { PersonalReport } from '../types';
import type { ResolvedRange } from '../dto';
import { bucketExpr, fillSeries, ratio } from './shared';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof estimateSchema &
    typeof authSchema &
    typeof pollSchema &
    typeof surveySchema
>;

const { card, vote, cardComment, retrospective, retroParticipant } =
  retroSchema;
const { teamMember } = teamSchema;
const { storyEstimateRound, storyEstimateSession, storyEstimateVote } =
  estimateSchema;
const { pollVote } = pollSchema;
const { surveyResponse } = surveySchema;

export async function buildPersonalReport(
  db: Database,
  userId: string,
  range: ResolvedRange,
): Promise<PersonalReport> {
  const { from, to, bucket } = range;

  // ── Contribution series (cards / votes / comments per bucket) ─────────────
  const [cardRows, voteRows, commentRows] = await Promise.all([
    db
      .select({ bucket: bucketExpr(bucket, card.createdAt), value: count() })
      .from(card)
      .where(
        and(
          eq(card.authorId, userId),
          gte(card.createdAt, from),
          lte(card.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, card.createdAt)),
    db
      .select({ bucket: bucketExpr(bucket, vote.createdAt), value: count() })
      .from(vote)
      .where(
        and(
          eq(vote.userId, userId),
          gte(vote.createdAt, from),
          lte(vote.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, vote.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, cardComment.createdAt),
        value: count(),
      })
      .from(cardComment)
      .where(
        and(
          eq(cardComment.authorId, userId),
          gte(cardComment.createdAt, from),
          lte(cardComment.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, cardComment.createdAt)),
  ]);

  const merged = new Map<
    string,
    { cards: number; votes: number; comments: number }
  >();
  const bump = (
    rows: Array<{ bucket: string; value: number }>,
    key: 'cards' | 'votes' | 'comments',
  ) => {
    for (const row of rows) {
      const entry = merged.get(row.bucket) ?? {
        cards: 0,
        votes: 0,
        comments: 0,
      };
      entry[key] = Number(row.value);
      merged.set(row.bucket, entry);
    }
  };
  bump(cardRows, 'cards');
  bump(voteRows, 'votes');
  bump(commentRows, 'comments');

  const contributions = fillSeries(
    from,
    to,
    bucket,
    [...merged.entries()].map(([bucketKey, values]) => ({
      bucket: bucketKey,
      ...values,
    })),
    (bucketKey) => ({ bucket: bucketKey, cards: 0, votes: 0, comments: 0 }),
  );

  // ── Attendance: retros I attended vs retros my teams completed ────────────
  const attendedRows = await db
    .select({
      bucket: bucketExpr(bucket, retrospective.completedAt),
      value: count(),
    })
    .from(retroParticipant)
    .innerJoin(retrospective, eq(retroParticipant.retroId, retrospective.id))
    .where(
      and(
        eq(retroParticipant.userId, userId),
        eq(retrospective.status, RETRO_STATUSES.Completed),
        isNotNull(retrospective.completedAt),
        gte(retrospective.completedAt, from),
        lte(retrospective.completedAt, to),
      ),
    )
    .groupBy(bucketExpr(bucket, retrospective.completedAt));

  const heldRows = await db
    .select({
      bucket: bucketExpr(bucket, retrospective.completedAt),
      value: count(),
    })
    .from(retrospective)
    .innerJoin(teamMember, eq(teamMember.teamId, retrospective.teamId))
    .where(
      and(
        eq(teamMember.userId, userId),
        eq(retrospective.status, RETRO_STATUSES.Completed),
        isNotNull(retrospective.completedAt),
        gte(retrospective.completedAt, from),
        lte(retrospective.completedAt, to),
      ),
    )
    .groupBy(bucketExpr(bucket, retrospective.completedAt));

  const attendanceMap = new Map<string, { attended: number; held: number }>();
  for (const row of heldRows) {
    attendanceMap.set(row.bucket, { attended: 0, held: Number(row.value) });
  }
  for (const row of attendedRows) {
    const entry = attendanceMap.get(row.bucket) ?? { attended: 0, held: 0 };
    entry.attended = Number(row.value);
    attendanceMap.set(row.bucket, entry);
  }
  const attendanceSeries = fillSeries(
    from,
    to,
    bucket,
    [...attendanceMap.entries()].map(([bucketKey, values]) => ({
      bucket: bucketKey,
      ...values,
    })),
    (bucketKey) => ({ bucket: bucketKey, attended: 0, held: 0 }),
  );
  const attended = attendanceSeries.reduce((sum, p) => sum + p.attended, 0);
  const held = attendanceSeries.reduce((sum, p) => sum + p.held, 0);

  // ── Polls & surveys I submitted (votes / responses per bucket) ────────────
  const [pollRows, surveyRows] = await Promise.all([
    db
      .select({
        bucket: bucketExpr(bucket, pollVote.createdAt),
        value: count(),
      })
      .from(pollVote)
      .where(
        and(
          eq(pollVote.userId, userId),
          gte(pollVote.createdAt, from),
          lte(pollVote.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, pollVote.createdAt)),
    db
      .select({
        bucket: bucketExpr(bucket, surveyResponse.createdAt),
        value: count(),
      })
      .from(surveyResponse)
      .where(
        and(
          eq(surveyResponse.userId, userId),
          gte(surveyResponse.createdAt, from),
          lte(surveyResponse.createdAt, to),
        ),
      )
      .groupBy(bucketExpr(bucket, surveyResponse.createdAt)),
  ]);

  const pollSurveyMerged = new Map<
    string,
    { polls: number; surveys: number }
  >();
  const bumpPollSurvey = (
    rows: Array<{ bucket: string; value: number }>,
    key: 'polls' | 'surveys',
  ) => {
    for (const row of rows) {
      const entry = pollSurveyMerged.get(row.bucket) ?? {
        polls: 0,
        surveys: 0,
      };
      entry[key] = Number(row.value);
      pollSurveyMerged.set(row.bucket, entry);
    }
  };
  bumpPollSurvey(pollRows, 'polls');
  bumpPollSurvey(surveyRows, 'surveys');

  const pollSurvey = fillSeries(
    from,
    to,
    bucket,
    [...pollSurveyMerged.entries()].map(([bucketKey, values]) => ({
      bucket: bucketKey,
      ...values,
    })),
    (bucketKey) => ({ bucket: bucketKey, polls: 0, surveys: 0 }),
  );

  // ── Story estimate votes I cast per bucket ────────────────────────────────
  const estimateVoteRows = await db
    .select({
      bucket: bucketExpr(bucket, storyEstimateVote.votedAt),
      value: count(),
    })
    .from(storyEstimateVote)
    .where(
      and(
        eq(storyEstimateVote.voterId, userId),
        gte(storyEstimateVote.votedAt, from),
        lte(storyEstimateVote.votedAt, to),
      ),
    )
    .groupBy(bucketExpr(bucket, storyEstimateVote.votedAt));
  const estimateVotes = fillSeries(
    from,
    to,
    bucket,
    estimateVoteRows.map((row) => ({
      bucket: row.bucket,
      votes: Number(row.value),
    })),
    (bucketKey) => ({ bucket: bucketKey, votes: 0 }),
  );

  // ── Story estimate participation & consensus agreement ────────────────────
  const [roundsHeldRow] = await db
    .select({ value: count() })
    .from(storyEstimateRound)
    .innerJoin(
      storyEstimateSession,
      eq(storyEstimateRound.sessionId, storyEstimateSession.id),
    )
    .innerJoin(teamMember, eq(teamMember.teamId, storyEstimateSession.teamId))
    .where(
      and(
        eq(teamMember.userId, userId),
        isNotNull(storyEstimateRound.revealedAt),
        gte(storyEstimateRound.revealedAt, from),
        lte(storyEstimateRound.revealedAt, to),
      ),
    );

  const [myVotesRow] = await db
    .select({
      roundsVoted: countDistinct(storyEstimateVote.roundId),
      agreements: count(
        sql`case when ${storyEstimateVote.points} = ${storyEstimateRound.agreedPoints} then 1 end`,
      ),
      votesOnAgreedRounds: count(
        sql`case when ${storyEstimateRound.agreedPoints} is not null then 1 end`,
      ),
    })
    .from(storyEstimateVote)
    .innerJoin(
      storyEstimateRound,
      eq(storyEstimateVote.roundId, storyEstimateRound.id),
    )
    .where(
      and(
        eq(storyEstimateVote.voterId, userId),
        gte(storyEstimateVote.votedAt, from),
        lte(storyEstimateVote.votedAt, to),
      ),
    );

  const roundsHeld = Number(roundsHeldRow?.value ?? 0);
  const roundsVoted = Number(myVotesRow?.roundsVoted ?? 0);

  return {
    range: range.asRange,
    contributions,
    pollSurvey,
    estimateVotes,
    attendance: {
      attended,
      held,
      rate: ratio(attended, held),
      series: attendanceSeries,
    },
    storyEstimates: {
      roundsVoted,
      roundsHeld,
      participationRate: ratio(roundsVoted, roundsHeld),
      agreementRate: ratio(
        Number(myVotesRow?.agreements ?? 0),
        Number(myVotesRow?.votesOnAgreedRounds ?? 0),
      ),
    },
  };
}
