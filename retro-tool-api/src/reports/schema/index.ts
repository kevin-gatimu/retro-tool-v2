// Reports module uses existing schemas for live analytics queries.
// No additional DB tables are needed at this time.

// ============================================================================
// Return-type interfaces (not DB tables)
// ============================================================================

export interface TeamMetrics {
  retroCount: number;
  avgParticipants: number;
  participationRate: number; // 0–100 %
  totalCards: number;
  totalVotes: number;
  avgCardsPerRetro: number;
  actionItemsCompleted: number;
  actionItemsPending: number;
}

export interface HealthScore {
  score: number; // 0–100
  participationPoints: number; // 0–30
  engagementPoints: number; // 0–25
  completionPoints: number | null; // 0–25, null when no action items exist
  frequencyPoints: number; // 0–20
  description: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface TopAssignee {
  userId: string;
  userName: string;
  assignedCount: number;
  completedCount: number;
}

export interface ActionItemAnalytics {
  totalAssigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  topAssignees: TopAssignee[];
}

export interface TemplateUsageMetrics {
  templateId: string;
  templateName: string;
  usageCount: number;
  avgCardsPerSession: number;
}

export interface UserStats {
  teamsCount: number;
  retroCount: number;
  cardsCreated: number;
  actionItemsAssigned: number;
  actionItemsCompleted: number;
  completionRate: number; // 0–100 %
}

export interface EstimateKPIs {
  sessionsCompleted: number;
  storiesEstimated: number;
  participationRate: number; // 0–100 %
  avgVotesPerStory: number;
}

export interface TeamBreakdown {
  teamId: string;
  teamName: string;
  retroCount: number;
  memberCount: number;
  participationRate: number; // 0–100 %
}

export interface OrgOverview {
  teamsCount: number;
  membersCount: number;
  retroCount: number;
  totalCards: number;
  totalVotes: number;
  participationRate: number; // avg across teams, 0–100 %
  actionItemsCompleted: number;
  actionItemsPending: number;
  teamBreakdown: TeamBreakdown[];
  teamBreakdownTotal: number;
  teamBreakdownPage: number;
  teamBreakdownLimit: number;
  teamBreakdownTotalPages: number;
}

export interface OrgBreakdown {
  orgId: string;
  orgName: string;
  teamsCount: number;
  membersCount: number;
  retroCount: number;
}

export interface SystemOverview {
  orgsCount: number;
  teamsCount: number;
  usersCount: number;
  retroCount: number; // last 30 days
  totalCards: number; // last 30 days
  orgBreakdown: OrgBreakdown[];
  orgBreakdownTotal: number;
  orgBreakdownPage: number;
  orgBreakdownLimit: number;
  orgBreakdownTotalPages: number;
}
