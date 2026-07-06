import type { Standup, StandupQuestion } from '../schema';
import type { PollView } from '../../polls/types';
import type { TIcebreakerSessionStatus } from '../../common/enums';

/**
 * Compact view of an icebreaker session attached to a standup day. The full
 * swipe/present runtime lives on the dedicated session page; the standup feed
 * only shows this summary card with a link to open it.
 */
export type IcebreakerEntrySession = {
  id: string;
  name: string;
  status: TIcebreakerSessionStatus;
  promptCount: number;
  keptCount: number;
  participantCount: number;
  canManage: boolean;
};

export type StandupQuestionView = Pick<
  StandupQuestion,
  'id' | 'prompt' | 'color' | 'order' | 'isRequired'
>;

export type StandupSummary = Standup & {
  team: { id: string; name: string; emoji: string | null };
  questions: StandupQuestionView[];
  memberCount: number;
  todaySubmissionCount: number;
  skippedDays: string[];
};

export type StandupDetail = Standup & {
  isCreator: boolean;
  canManage: boolean;
  currentUserId: string;
  team: { id: string; name: string };
  questions: StandupQuestionView[];
  skippedDays: string[];
};

export type StandupMemberView = {
  userId: string;
  name: string;
  image: string | null;
  jobRole: string | null;
  hasSubmitted: boolean;
};

export type StandupAnswerView = {
  questionId: string;
  content: string;
};

export type StandupCommentView = {
  id: string;
  authorId: string;
  author: { name: string; image: string | null };
  content: string;
  createdAt: Date;
};

export type StandupReactionView = {
  emoji: string;
  userId: string;
  userName: string;
};

export type StandupSubmissionView = {
  id: string;
  userId: string;
  user: { name: string; image: string | null };
  createdAt: Date;
  updatedAt: Date;
  answers: StandupAnswerView[];
  comments: StandupCommentView[];
  reactions: StandupReactionView[];
};

export type StandupEntryDetail = {
  standup: StandupDetail;
  date: string;
  entry: { id: string; entryDate: string } | null;
  isScheduledDay: boolean;
  isSkipped: boolean;
  members: StandupMemberView[];
  submissions: StandupSubmissionView[];
  polls: PollView[];
  icebreakers: IcebreakerEntrySession[];
};
