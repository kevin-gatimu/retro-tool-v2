import type { Standup, StandupQuestion } from '../schema';
import type { PollView } from '../../polls/types';

export type StandupQuestionView = Pick<
  StandupQuestion,
  'id' | 'prompt' | 'color' | 'order' | 'isRequired'
>;

export type StandupSummary = Standup & {
  team: { id: string; name: string; emoji: string | null };
  questions: StandupQuestionView[];
  memberCount: number;
  todaySubmissionCount: number;
};

export type StandupDetail = Standup & {
  isCreator: boolean;
  canManage: boolean;
  currentUserId: string;
  team: { id: string; name: string };
  questions: StandupQuestionView[];
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
  members: StandupMemberView[];
  submissions: StandupSubmissionView[];
  polls: PollView[];
};
