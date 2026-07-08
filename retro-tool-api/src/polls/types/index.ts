import type { Poll } from '../schema';

export type PollOptionView = {
  id: string;
  label: string;
  emoji: string | null;
  order: number;
  voteCount: number;
  /** Only populated for non-anonymous polls. */
  voters: { userId: string; name: string; image: string | null }[];
  isOwnVote: boolean;
};

export type PollView = Poll & {
  isCreator: boolean;
  canManage: boolean;
  currentUserId: string;
  team: { id: string; name: string; emoji: string | null };
  createdBy: { id: string; name: string; image: string | null } | null;
  options: PollOptionView[];
  totalVotes: number;
  hasVoted: boolean;
};
