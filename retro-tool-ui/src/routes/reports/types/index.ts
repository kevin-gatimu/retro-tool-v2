// Mirrors retro-tool-api/src/reports/types (v2 dashboards).

export type ReportBucket = 'day' | 'week' | 'month'
export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year'

export interface ReportRange {
  from: string
  to: string
  bucket: ReportBucket
}

export interface ContributionPoint {
  bucket: string
  cards: number
  votes: number
  comments: number
}

export interface AttendancePoint {
  bucket: string
  attended: number
  held: number
}

export interface PollSurveyPoint {
  bucket: string
  polls: number
  surveys: number
}

export interface EstimateVotePoint {
  bucket: string
  votes: number
}

export interface PersonalReport {
  range: ReportRange
  contributions: ContributionPoint[]
  pollSurvey: PollSurveyPoint[]
  estimateVotes: EstimateVotePoint[]
  attendance: {
    attended: number
    held: number
    rate: number
    series: AttendancePoint[]
  }
  storyEstimates: {
    roundsVoted: number
    roundsHeld: number
    participationRate: number
    agreementRate: number
  }
}

export interface TeamAttendancePoint {
  bucket: string
  retros: number
  attendanceRate: number
}

export interface SentimentSlice {
  column: string
  cards: number
}

export interface VoteHistogramBin {
  votes: string
  cards: number
}

export interface EstimateVelocityPoint {
  bucket: string
  roundsRevealed: number
  roundsAgreed: number
}

export interface StandupPoint {
  bucket: string
  submissionRate: number
  entries: number
}

export interface TeamMemberBreakdownRow {
  userId: string
  name: string
  cardsAuthored: number
  votesCast: number
  retrosAttended: number
}

export interface TeamReport {
  range: ReportRange
  teamId: string
  teamName: string
  isLead: boolean
  kpis: {
    retrosCompleted: number
    attendanceRate: number
    cardsPerRetro: number
    discussionCoverage: number
    consensusRate: number
  }
  health: {
    score: number
    components: {
      participation: number
      engagement: number
      consensus: number
      frequency: number
    }
    description: string
  }
  attendanceSeries: TeamAttendancePoint[]
  sentiment: SentimentSlice[]
  voteHistogram: VoteHistogramBin[]
  estimateVelocity: EstimateVelocityPoint[]
  standupSeries: StandupPoint[]
  voteSpreadAvg: number
  memberBreakdown?: TeamMemberBreakdownRow[]
}

export interface OrgGrowthPoint {
  bucket: string
  members: number
  teams: number
}

export interface OrgTeamLeagueRow {
  teamId: string
  name: string
  members: number
  retrosInRange: number
  attendanceRate: number
}

export interface TemplateUsageSlice {
  template: string
  count: number
}

export interface AtRiskTeamRow {
  teamId: string
  name: string
  lastCompletedRetroAt: string | null
  daysSinceLastRetro: number | null
}

export interface OrgReport {
  range: ReportRange
  orgId: string
  orgName: string
  kpis: {
    teams: number
    members: number
    retrosInRange: number
    activeTeamsInRange: number
  }
  growth: OrgGrowthPoint[]
  cadenceHeat: CadenceCell[]
  templateUsage: TemplateUsageSlice[]
  atRiskTeams: AtRiskTeamRow[]
}

export interface CadenceCell {
  teamId: string
  teamName: string
  bucket: string
  retros: number
}

export interface Paginated<TRow> {
  rows: TRow[]
  page: number
  pageSize: number
  total: number
}

export interface UserGrowthPoint {
  bucket: string
  signups: number
}

export interface StatusFunnelSlice {
  status: string
  count: number
}

export interface ActivityPoint {
  bucket: string
  retros: number
  storyEstimateSessions: number
  standups: number
  surveys: number
  polls: number
  icebreakerSessions: number
}

export interface OrgLeagueRow {
  orgId: string
  name: string
  members: number
  teams: number
  retrosInRange: number
}

export interface PlatformReport {
  range: ReportRange
  kpis: {
    totalUsers: number
    pendingUsers: number
    activeUsers7d: number
    activeUsers30d: number
    organizations: number
    teams: number
  }
  userGrowth: UserGrowthPoint[]
  statusFunnel: StatusFunnelSlice[]
  activity: ActivityPoint[]
}
