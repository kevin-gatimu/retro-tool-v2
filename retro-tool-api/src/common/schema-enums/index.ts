import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ADMIN_ACTION_LOG_ACTIONS,
  EMAIL_LOG_STATUSES,
  EMAIL_LOG_TYPES,
  ESTIMATE_SESSION_STATUSES,
  ICEBREAKER_FLAVOURS,
  ICEBREAKER_PROMPT_DECISIONS,
  ICEBREAKER_SESSION_STATUSES,
  NOTIFICATION_TYPES,
  ORG_MEMBER_ROLES,
  RETRO_STATUSES,
  RETRO_VOTE_TYPES,
  STANDUP_CADENCES,
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
  USER_STATUSES,
} from '../enums';

// User
export const userRoleEnum = pgEnum('user_role', [
  USER_ROLES.SuperAdmin,
  USER_ROLES.SystemAdmin,
  USER_ROLES.OrgAdmin,
  USER_ROLES.TeamLead,
  USER_ROLES.Member,
]);

export const userStatusEnum = pgEnum('user_status', [
  USER_STATUSES.Pending,
  USER_STATUSES.Approved,
  USER_STATUSES.Rejected,
  USER_STATUSES.Suspended,
]);

export const adminActionLogActionEnum = pgEnum('admin_action_log_action', [
  ADMIN_ACTION_LOG_ACTIONS.UserApproved,
  ADMIN_ACTION_LOG_ACTIONS.UserRejected,
  ADMIN_ACTION_LOG_ACTIONS.UserSuspended,
  ADMIN_ACTION_LOG_ACTIONS.UserReactivated,
  ADMIN_ACTION_LOG_ACTIONS.UserRoleChanged,
  ADMIN_ACTION_LOG_ACTIONS.UserDeleted,
  ADMIN_ACTION_LOG_ACTIONS.PasswordResetTriggered,
]);

// Organization
export const orgMemberRoleEnum = pgEnum('org_member_role', [
  ORG_MEMBER_ROLES.Owner,
  ORG_MEMBER_ROLES.Admin,
  ORG_MEMBER_ROLES.Member,
]);

// Team
export const teamMemberTagEnum = pgEnum('team_member_tag', [
  TEAM_MEMBER_TAGS.Lead,
  TEAM_MEMBER_TAGS.Member,
]);

export const teamJoinRequestStatusEnum = pgEnum('team_join_request_status', [
  TEAM_JOIN_REQUEST_STATUSES.Pending,
  TEAM_JOIN_REQUEST_STATUSES.Approved,
  TEAM_JOIN_REQUEST_STATUSES.Rejected,
]);

// Retro
export const retroStatusEnum = pgEnum('retro_status', [
  RETRO_STATUSES.Draft,
  RETRO_STATUSES.Waiting,
  RETRO_STATUSES.Active,
  RETRO_STATUSES.Grouping,
  RETRO_STATUSES.Voting,
  RETRO_STATUSES.Discussing,
  RETRO_STATUSES.Completed,
]);

export const retroVoteTypeEnum = pgEnum('retro_vote_type', [
  RETRO_VOTE_TYPES.Multi,
  RETRO_VOTE_TYPES.Single,
]);

export const actionItemStatusEnum = pgEnum('action_item_status', [
  'pending',
  'in_progress',
  'completed',
]);

// Notifications
export const notificationTypeEnum = pgEnum('notification_type', [
  NOTIFICATION_TYPES.UserSignup,
  NOTIFICATION_TYPES.TeamJoinRequest,
  NOTIFICATION_TYPES.TeamJoinApproved,
  NOTIFICATION_TYPES.TeamJoinRejected,
  NOTIFICATION_TYPES.OrgInvite,
  NOTIFICATION_TYPES.TeamInvite,
  NOTIFICATION_TYPES.RetroCreated,
  NOTIFICATION_TYPES.RetroLobbyOpen,
  NOTIFICATION_TYPES.RetroStarted,
  NOTIFICATION_TYPES.RetroCompleted,
  NOTIFICATION_TYPES.ActionItemAssigned,
  NOTIFICATION_TYPES.ActionItemDueSoon,
  NOTIFICATION_TYPES.EstimateSessionCreated,
  NOTIFICATION_TYPES.IcebreakerSessionCreated,
  NOTIFICATION_TYPES.StandupCreated,
  NOTIFICATION_TYPES.StandupCommentAdded,
  NOTIFICATION_TYPES.ConvexTableClear,
]);

// Estimates
export const estimateSessionStatusEnum = pgEnum('estimate_session_status', [
  ESTIMATE_SESSION_STATUSES.Waiting,
  ESTIMATE_SESSION_STATUSES.Voting,
  ESTIMATE_SESSION_STATUSES.Revealed,
  ESTIMATE_SESSION_STATUSES.Completed,
]);

// Icebreakers
export const icebreakerSessionStatusEnum = pgEnum('icebreaker_session_status', [
  ICEBREAKER_SESSION_STATUSES.Waiting,
  ICEBREAKER_SESSION_STATUSES.Curating,
  ICEBREAKER_SESSION_STATUSES.Presenting,
  ICEBREAKER_SESSION_STATUSES.Completed,
]);

export const icebreakerFlavourEnum = pgEnum('icebreaker_flavour', [
  ICEBREAKER_FLAVOURS.Fun,
  ICEBREAKER_FLAVOURS.Professional,
  ICEBREAKER_FLAVOURS.Creative,
]);

export const icebreakerPromptDecisionEnum = pgEnum(
  'icebreaker_prompt_decision',
  [
    ICEBREAKER_PROMPT_DECISIONS.Pending,
    ICEBREAKER_PROMPT_DECISIONS.Kept,
    ICEBREAKER_PROMPT_DECISIONS.Skipped,
  ],
);

// Standups
export const standupCadenceEnum = pgEnum('standup_cadence', [
  STANDUP_CADENCES.Daily,
  STANDUP_CADENCES.Weekly,
  STANDUP_CADENCES.Fortnightly,
  STANDUP_CADENCES.Once,
]);

// Surveys
export const surveyScopeEnum = pgEnum('survey_scope', [
  SURVEY_SCOPES.Team,
  SURVEY_SCOPES.Org,
  SURVEY_SCOPES.System,
]);

export const surveyQuestionTypeEnum = pgEnum('survey_question_type', [
  SURVEY_QUESTION_TYPES.Text,
  SURVEY_QUESTION_TYPES.Rating,
  SURVEY_QUESTION_TYPES.Choice,
]);

// Email
export const emailLogTypeEnum = pgEnum('email_log_type', [
  EMAIL_LOG_TYPES.Verification,
  EMAIL_LOG_TYPES.AccountApproved,
  EMAIL_LOG_TYPES.OrgInvite,
  EMAIL_LOG_TYPES.OrgInviteExternal,
  EMAIL_LOG_TYPES.TeamInvite,
  EMAIL_LOG_TYPES.TeamInviteExternal,
  EMAIL_LOG_TYPES.RetroReport,
  EMAIL_LOG_TYPES.StandupReport,
]);

export const emailLogStatusEnum = pgEnum('email_log_status', [
  EMAIL_LOG_STATUSES.Sent,
  EMAIL_LOG_STATUSES.Bounced,
  EMAIL_LOG_STATUSES.Failed,
]);
