import type { StoryEstimateSession } from '../schema';

export type SessionSummary = StoryEstimateSession & {
  team: { id: string; name: string };
  participants: { userId: string; isOnline: boolean }[];
};

export type SessionDetail = StoryEstimateSession & {
  isCreator: boolean;
  currentUserId: string;
  userVote: string | null;
  team: { id: string; name: string };
  createdBy: { id: string; name: string; image: string | null };
  participants: {
    id: string;
    userId: string;
    isOnline: boolean;
    joinedAt: Date;
    user: {
      id: string;
      name: string;
      image: string | null;
      jobRole: string | null;
    };
  }[];
  votes: {
    id: string;
    voterId: string;
    userId: string;
    points: string;
    value: string;
    user: { id: string; name: string };
  }[];
  currentRound: {
    id: string;
    roundNumber: number;
    storyName: string;
    ticketNumber: string;
    storyDescription: string | null;
    storyLink: string | null;
    status: string;
  } | null;
  rounds: {
    id: string;
    roundNumber: number;
    storyName: string;
    ticketNumber: string;
    storyDescription: string | null;
    storyLink: string | null;
    status: string;
    revealedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    votes: {
      id: string;
      voterId: string;
      userId: string;
      points: string;
      value: string;
      user: { id: string; name: string };
    }[];
    stats: {
      votesCount: number;
      average: number | null;
      min: number | null;
      max: number | null;
      consensus: string | null;
    };
  }[];
};

export type EstimateVoteView = {
  id: string;
  voterId: string;
  userId: string;
  points: string;
  value: string;
  user: { id: string; name: string };
};
