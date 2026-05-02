import type { StoryEstimateSession } from '../schema';

export type SessionSummary = StoryEstimateSession & {
  team: { id: string; name: string };
  participants: { userId: string; isOnline: boolean }[];
};

export type EstimateTemplateValueView = {
  id: string;
  label: string;
  value: string;
  order: number;
  color: string | null;
  description: string | null;
};

export type SessionTemplate = {
  id: string;
  name: string;
  color: string | null;
  values: EstimateTemplateValueView[];
};

export type SessionDetail = StoryEstimateSession & {
  isCreator: boolean;
  canEndSession: boolean;
  currentUserId: string;
  userVote: string | null;
  template: SessionTemplate | null;
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
    user: { id: string; name: string; jobRole: string | null };
  }[];
  currentRound: {
    id: string;
    roundNumber: number;
    storyName: string;
    ticketNumber: string;
    storyDescription: string | null;
    storyLink: string | null;
    status: string;
    createdAt: Date;
  } | null;
  rounds: {
    id: string;
    roundNumber: number;
    storyName: string;
    ticketNumber: string;
    storyDescription: string | null;
    storyLink: string | null;
    status: string;
    agreedPoints: string | null;
    revealedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    votes: {
      id: string;
      voterId: string;
      userId: string;
      points: string;
      value: string;
      user: { id: string; name: string; jobRole: string | null };
    }[];
    stats: {
      votesCount: number;
      average: number | null;
      min: number | null;
      max: number | null;
    };
  }[];
};

export type EstimateVoteView = {
  id: string;
  voterId: string;
  userId: string;
  points: string;
  value: string;
  user: { id: string; name: string; jobRole: string | null };
};
