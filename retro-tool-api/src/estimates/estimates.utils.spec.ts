import {
  roundStoryLabel,
  pointsToNumber,
  computeRoundStats,
} from './estimates.utils';
import type { EstimateVoteView } from './types/index';

describe('estimates.utils', () => {
  describe('roundStoryLabel', () => {
    it('combines ticket and story name', () => {
      expect(roundStoryLabel('Login page', 'SPR-1')).toBe('SPR-1 - Login page');
    });

    it('returns just the ticket when the story name is empty', () => {
      expect(roundStoryLabel('   ', 'SPR-1')).toBe('SPR-1');
    });

    it('returns just the ticket when the story name equals the ticket', () => {
      expect(roundStoryLabel('SPR-1', 'SPR-1')).toBe('SPR-1');
    });
  });

  describe('pointsToNumber', () => {
    it('parses the ½ glyph to 0.5', () => {
      expect(pointsToNumber('½')).toBe(0.5);
    });

    it('parses numeric strings', () => {
      expect(pointsToNumber('8')).toBe(8);
    });

    it('returns null for non-numeric points (e.g. "?")', () => {
      expect(pointsToNumber('?')).toBeNull();
    });
  });

  describe('computeRoundStats', () => {
    const vote = (points: string): EstimateVoteView =>
      ({ points }) as EstimateVoteView;

    it('returns zeros for no votes', () => {
      expect(computeRoundStats([])).toEqual({
        votesCount: 0,
        average: null,
        min: null,
        max: null,
      });
    });

    it('averages numeric votes and reports min/max', () => {
      expect(computeRoundStats([vote('2'), vote('4'), vote('8')])).toEqual({
        votesCount: 3,
        average: 4.67,
        min: 2,
        max: 8,
      });
    });

    it('counts non-numeric votes but excludes them from the average', () => {
      expect(computeRoundStats([vote('4'), vote('?')])).toEqual({
        votesCount: 2,
        average: 4,
        min: 4,
        max: 4,
      });
    });
  });
});
