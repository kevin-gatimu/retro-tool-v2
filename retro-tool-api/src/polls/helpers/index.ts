import type { Poll, PollOption, PollVote } from '../schema';
import type { PollOptionView, PollView } from '../types';

export type PollVoterRow = PollVote & {
  userName: string;
  userImage: string | null;
};

/**
 * Pure assembler shared by PollsService and StandupsService so embedded
 * standup-room polls and the standalone /polls feature stay consistent.
 */
export function assemblePollView(
  pollRecord: Poll,
  options: PollOption[],
  votes: PollVoterRow[],
  context: {
    currentUserId: string;
    canManage: boolean;
    team: { id: string; name: string; emoji: string | null };
    createdBy: { id: string; name: string; image: string | null } | null;
  },
): PollView {
  const pollVotes = votes.filter((vote) => vote.pollId === pollRecord.id);
  const ownVote = pollVotes.find(
    (vote) => vote.userId === context.currentUserId,
  );

  const optionViews: PollOptionView[] = options
    .filter((option) => option.pollId === pollRecord.id)
    .sort((left, right) => left.order - right.order)
    .map((option) => {
      const optionVotes = pollVotes.filter(
        (vote) => vote.optionId === option.id,
      );
      return {
        id: option.id,
        label: option.label,
        emoji: option.emoji,
        order: option.order,
        voteCount: optionVotes.length,
        voters: pollRecord.isAnonymous
          ? []
          : optionVotes.map((vote) => ({
              userId: vote.userId,
              name: vote.userName,
              image: vote.userImage,
            })),
        isOwnVote: ownVote?.optionId === option.id,
      };
    });

  return {
    ...pollRecord,
    isCreator: pollRecord.createdById === context.currentUserId,
    canManage: context.canManage,
    currentUserId: context.currentUserId,
    team: context.team,
    createdBy: context.createdBy,
    options: optionViews,
    totalVotes: pollVotes.length,
    hasVoted: Boolean(ownVote),
  };
}
