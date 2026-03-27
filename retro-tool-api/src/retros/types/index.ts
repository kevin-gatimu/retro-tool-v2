/**
 * Retros service type definitions
 */

import type { Retrospective, TemplateColumn } from '../schema';

export type TemplateMutationResult = { id: string };
export type TemplateDeleteResult = { success: true };
export type TemplateSeedResult = { message: string };

/**
 * Snapshot of a source card before merge
 */
export type MergeSourceCardSnapshot = {
  authorId: string;
  columnId: string;
  content: string;
};

/**
 * Metadata embedded in merged card content
 */
export type MergeMetadata = {
  version: 1;
  sourceCards: MergeSourceCardSnapshot[];
};

/**
 * Full retro detail response including computed fields
 */
export type RetroDetailResponse = Retrospective & {
  team: {
    id: string;
    name: string;
  };
  template: {
    id: string;
    name: string;
    columns: TemplateColumn[];
  };
  participants: {
    id: string;
    userId: string;
  }[];
  cards: {
    id: string;
    columnId: string;
    content: string;
    sourceContents?: string[];
    mergedFromNames: string[];
    mergedCount: number;
    canUnmerge: boolean;
    isDiscussed: boolean;
    isCarriedForward?: boolean;
    discussedAt: Date | null;
    voteCount: number;
    hasVoted: boolean;
    isOwn: boolean;
    author: {
      id: string;
      name: string | null;
      image: string | null;
      jobRole: string | null;
    } | null;
    comments: {
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      isOwn: boolean;
      author: {
        id: string;
        name: string | null;
        image: string | null;
      } | null;
    }[];
  }[];
  timerRunning: boolean;
  timeRemaining: number;
  userVoteCount: number;
  isParticipant: boolean;
  isCreator: boolean;
  isTeamLead: boolean;
  isOrgAdmin: boolean;
  isSystemAdmin: boolean;
  currentUserId: string;
  currentDiscussionCardId: string | null;
  currentDiscussionActionItemId: string | null;
};
