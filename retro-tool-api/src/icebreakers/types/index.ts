import type { IcebreakerSession, IcebreakerSessionPrompt } from '../schema';
import type { TIcebreakerFlavour } from '../../common/enums';

export type SessionSummary = IcebreakerSession & {
  team: { id: string; name: string; emoji: string | null };
  participants: { userId: string; isOnline: boolean }[];
};

/**
 * Lightweight view of an icebreaker session attached to a standup day. Rendered
 * as a compact card in the standup feed; the full runtime lives on the session
 * page.
 */
export type IcebreakerEntrySession = {
  id: string;
  name: string;
  status: IcebreakerSession['status'];
  currentPromptId: string | null;
  promptCount: number;
  keptCount: number;
  participantCount: number;
  canManage: boolean;
  createdById: string;
  createdAt: Date;
};

export type IcebreakerPromptView = {
  id: string;
  text: string;
  order: number;
  color: string | null;
};

export type SessionTemplate = {
  id: string;
  name: string;
  flavour: TIcebreakerFlavour;
  color: string | null;
  prompts: IcebreakerPromptView[];
};

export type DeckPromptView = {
  id: string;
  text: string;
  deckOrder: number;
  decision: IcebreakerSessionPrompt['decision'];
  presentedAt: Date | null;
};

export type SessionDetail = IcebreakerSession & {
  isCreator: boolean;
  canManage: boolean;
  currentUserId: string;
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
  deck: DeckPromptView[];
  currentPrompt: DeckPromptView | null;
  pendingCount: number;
};
