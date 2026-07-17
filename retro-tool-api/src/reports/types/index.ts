/**
 * Reports v2 response types (REPORTS-REDESIGN-PLAN §6).
 *
 * All time series are pre-bucketed in SQL (`day | week | month`) and
 * gap-filled server-side, so payloads are chart-ready. The legacy v1 types
 * remain in ../schema until the v1 endpoints are retired.
 */

export type ReportBucket = 'day' | 'week' | 'month';

export type ReportPeriodPreset = 'week' | 'month' | 'quarter' | 'year';

export interface ReportRange {
  /** ISO date (inclusive) */
  from: string;
  /** ISO date (inclusive) */
  to: string;
  bucket: ReportBucket;
}

// ── Personal (“My Insights”) ─────────────────────────────────────────────────

export interface ContributionPoint {
  bucket: string;
  cards: number;
  votes: number;
  comments: number;
}

export interface AttendancePoint {
  bucket: string;
  attended: number;
  held: number;
}

/** poll votes + survey responses I submitted per bucket */
export interface PollSurveyPoint {
  bucket: string;
  polls: number;
  surveys: number;
}

/** story estimate votes I cast per bucket */
export interface EstimateVotePoint {
  bucket: string;
  votes: number;
}

export interface PersonalReport {
  range: ReportRange;
  contributions: ContributionPoint[];
  /** poll votes and survey responses I submitted per bucket */
  pollSurvey: PollSurveyPoint[];
  /** story estimate votes I cast per bucket */
  estimateVotes: EstimateVotePoint[];
  attendance: {
    attended: number;
    held: number;
    rate: number;
    series: AttendancePoint[];
  };
  storyEstimates: {
    roundsVoted: number;
    roundsHeld: number;
    participationRate: number;
    /** share of my votes matching the round's agreed points */
    agreementRate: number;
  };
}

// ── Team health ──────────────────────────────────────────────────────────────

export interface HealthComponents {
  participation: number;
  engagement: number;
  consensus: number;
  frequency: number;
}

export interface TeamHealth {
  score: number;
  components: HealthComponents;
  description: string;
}

export interface TeamAttendancePoint {
  bucket: string;
  retros: number;
  attendanceRate: number;
}

export interface SentimentSlice {
  column: string;
  cards: number;
}

export interface VoteHistogramBin {
  votes: string; // '0' | '1' | '2' | '3+'
  cards: number;
}

export interface EstimateVelocityPoint {
  bucket: string;
  roundsRevealed: number;
  roundsAgreed: number;
}

export interface StandupPoint {
  bucket: string;
  /** submissions ÷ (entries × members), % */
  submissionRate: number;
  entries: number;
}

export interface TeamMemberBreakdownRow {
  userId: string;
  name: string;
  cardsAuthored: number;
  votesCast: number;
  retrosAttended: number;
}

export interface TeamReport {
  range: ReportRange;
  teamId: string;
  teamName: string;
  /** whether the caller gets lead-level fields (memberBreakdown) */
  isLead: boolean;
  kpis: {
    retrosCompleted: number;
    attendanceRate: number;
    cardsPerRetro: number;
    discussionCoverage: number;
    consensusRate: number;
  };
  health: TeamHealth;
  attendanceSeries: TeamAttendancePoint[];
  sentiment: SentimentSlice[];
  voteHistogram: VoteHistogramBin[];
  estimateVelocity: EstimateVelocityPoint[];
  /** empty when the team doesn't use standups */
  standupSeries: StandupPoint[];
  /** avg distinct point values per revealed round (lower = tighter consensus) */
  voteSpreadAvg: number;
  /** present only when isLead */
  memberBreakdown?: TeamMemberBreakdownRow[];
}

// ── Organization ─────────────────────────────────────────────────────────────

export interface OrgGrowthPoint {
  bucket: string;
  members: number;
  teams: number;
}

export interface OrgTeamLeagueRow {
  teamId: string;
  name: string;
  members: number;
  retrosInRange: number;
  attendanceRate: number;
}

export interface TemplateUsageSlice {
  template: string;
  count: number;
}

export interface AtRiskTeamRow {
  teamId: string;
  name: string;
  lastCompletedRetroAt: string | null;
  daysSinceLastRetro: number | null;
}

export interface CadenceCell {
  teamId: string;
  teamName: string;
  bucket: string;
  retros: number;
}

export interface OrgReport {
  range: ReportRange;
  orgId: string;
  orgName: string;
  kpis: {
    teams: number;
    members: number;
    retrosInRange: number;
    activeTeamsInRange: number;
  };
  growth: OrgGrowthPoint[];
  /** retro cadence heat data: one cell per team × bucket with retros > 0 */
  cadenceHeat: CadenceCell[];
  templateUsage: TemplateUsageSlice[];
  atRiskTeams: AtRiskTeamRow[];
}

// ── Paginated league tables (separate endpoints; SQL pagination + search) ───

export interface Paginated<Row> {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
}

// ── Platform ─────────────────────────────────────────────────────────────────

export interface UserGrowthPoint {
  bucket: string;
  signups: number;
}

export interface StatusFunnelSlice {
  status: string;
  count: number;
}

export interface ActivityPoint {
  bucket: string;
  retros: number;
  storyEstimateSessions: number;
  standups: number;
  surveys: number;
  polls: number;
  icebreakerSessions: number;
}

export interface OrgLeagueRow {
  orgId: string;
  name: string;
  members: number;
  teams: number;
  retrosInRange: number;
}

export interface PlatformReport {
  range: ReportRange;
  kpis: {
    totalUsers: number;
    pendingUsers: number;
    activeUsers7d: number;
    activeUsers30d: number;
    organizations: number;
    teams: number;
  };
  userGrowth: UserGrowthPoint[];
  statusFunnel: StatusFunnelSlice[];
  activity: ActivityPoint[];
}

// ── Guard request augmentation ───────────────────────────────────────────────

export interface ReportAccess {
  isLead: boolean;
}

export interface ReportsRequestSession {
  session?: { user?: { id?: string } };
  reportAccess?: ReportAccess;
  params: Record<string, string>;
}
