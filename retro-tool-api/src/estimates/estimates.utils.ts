import type { EstimateVoteView } from './types/index';

/**
 * Pure helpers for story-estimate calculations — no DB or service state. Kept
 * out of the service so the round-stats maths can be unit-tested in isolation
 * and reused by the query/report services.
 */

/** Human-readable label for a round: "TICKET - Story name" (or just the ticket). */
export function roundStoryLabel(
  storyName: string,
  ticketNumber: string,
): string {
  const normalizedStoryName = storyName.trim();
  if (!normalizedStoryName || normalizedStoryName === ticketNumber) {
    return ticketNumber;
  }
  return `${ticketNumber} - ${normalizedStoryName}`;
}

/** Parse a card's point value to a number; `½` → 0.5, non-numeric → null. */
export function pointsToNumber(points: string): number | null {
  if (points === '½') return 0.5;
  const parsed = Number.parseFloat(points);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface RoundStats {
  votesCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

/** Aggregate a round's votes into count/average/min/max over numeric points. */
export function computeRoundStats(votes: EstimateVoteView[]): RoundStats {
  if (votes.length === 0) {
    return { votesCount: 0, average: null, min: null, max: null };
  }

  const numericVotes = votes
    .map((vote) => pointsToNumber(vote.points))
    .filter((value): value is number => value !== null);

  if (numericVotes.length === 0) {
    return { votesCount: votes.length, average: null, min: null, max: null };
  }

  const average =
    numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length;
  const sorted = [...numericVotes].sort((a, b) => a - b);

  return {
    votesCount: votes.length,
    average: Number(average.toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
