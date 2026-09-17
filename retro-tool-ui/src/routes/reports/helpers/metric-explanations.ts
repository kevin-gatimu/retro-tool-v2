import type { MetricExplanation } from '../types'

/**
 * How every team-report number is derived, in plain language.
 *
 * These mirror `buildTeamReport` in
 * `retro-tool-api/src/reports/queries/team-report.queries.ts` — if a formula or
 * weight changes there, update the matching entry here.
 */
export const TEAM_METRIC_EXPLANATIONS = {
  retrosCompleted: {
    label: 'Retros completed',
    summary:
      'How many of this team’s retros were finished inside the selected period.',
    formula: 'Retros with status "completed" and a completion date in range',
    notes: [
      'Retros still in progress, or completed outside the period, are excluded.',
      'Every other retro metric on this page is measured over just these retros.',
    ],
  },
  attendance: {
    label: 'Attendance',
    summary:
      'The share of possible seats that were actually filled across completed retros.',
    formula: 'Recorded participants ÷ (completed retros × team members)',
    notes: [
      'Counts real participation, not invitations — someone must have joined the retro to be counted.',
      'Because the denominator is current team size, recent joiners lower the rate for retros held before they joined.',
    ],
  },
  discussionCoverage: {
    label: 'Discussion coverage',
    summary:
      'How much of what the team wrote down actually got talked through.',
    formula: 'Cards marked discussed ÷ all cards created',
    notes: [
      'A card counts as discussed once it is marked so during the retro.',
      'The hint below the number is cards per retro: all cards ÷ completed retros.',
      'Low coverage with high card volume usually means retros are running out of time.',
    ],
  },
  estimateConsensus: {
    label: 'Estimate consensus',
    summary:
      'How often a story estimate round ended with the team agreeing on a number.',
    formula: 'Rounds with agreed points ÷ rounds revealed',
    notes: [
      'Only rounds revealed inside the period are counted.',
      'Average vote spread is the mean number of *distinct* point values per round — lower means the team was already aligned before discussing.',
    ],
  },
  healthScore: {
    label: 'Health score',
    summary:
      'A single 0–100 roll-up of four signals, weighted by how strongly each one indicates a healthy retro habit.',
    formula:
      'Participation × 30% + Engagement × 25% + Consensus × 25% + Frequency × 20%',
    notes: [
      'Each of the four parts is scored out of 100 first, then weighted and summed — see the Health components card for the current values.',
      'Bands: 80+ excellent · 60–79 good · 40–59 needs improvement · under 40 critical.',
      'Every part is capped at 100, so exceeding a target cannot mask a weak area elsewhere.',
    ],
  },
  healthComponents: {
    label: 'Health components',
    summary:
      'The four inputs to the health score, each scored out of 100 before weighting.',
    notes: [
      'Participation (30%) — the attendance rate exactly as shown above.',
      'Engagement (25%) — cards per member per retro, where 2 cards each scores 100.',
      'Consensus (25%) — the estimate consensus rate exactly as shown above.',
      'Frequency (20%) — retros per month, where 2 per month scores 100.',
      'A part reads 0 when there is nothing to measure — no completed retros, or no revealed estimate rounds.',
    ],
  },
  attendanceTrend: {
    label: 'Attendance trend',
    summary:
      'The same attendance rate, but recalculated for each point in the period so you can see the direction of travel.',
    formula:
      'Per bucket: recorded participants ÷ (retros in that bucket × team members)',
    notes: [
      'Buckets are days, weeks, or months depending on the period you picked.',
      'Buckets with no completed retros are plotted as 0 rather than skipped, so gaps in the habit stay visible.',
    ],
  },
  sentimentMix: {
    label: 'Sentiment mix',
    summary:
      'Where the team’s feedback landed — how many cards went into each column of the retro template.',
    formula: 'Cards grouped by template column, across all completed retros',
    notes: [
      'Column names come from the templates used, so the bars change if the team switches template.',
      'Retros using different templates are pooled together by column name.',
    ],
  },
  voteConcentration: {
    label: 'Vote concentration',
    summary:
      'Whether attention focused on a few cards or spread thinly across many.',
    formula:
      'Cards grouped by how many votes each received (0, 1, 2, 3 or more)',
    notes: [
      'Each bar is a count of cards, not of votes.',
      'A large 0-votes bar means much of what was written never drew interest — often a sign of too many cards for the time available.',
    ],
  },
  estimateVelocity: {
    label: 'Story estimate velocity',
    summary:
      'Estimation throughput over time: how many rounds were revealed, and how many of those settled on agreed points.',
    formula:
      'Per bucket: rounds revealed, and rounds that reached agreed points',
    notes: [
      'The gap between the two lines is rounds that were revealed but never agreed.',
      'Rounds are placed in a bucket by when they were revealed.',
    ],
  },
  standupSubmissions: {
    label: 'Standup submissions',
    summary: 'How reliably the team files its standup entries.',
    formula: 'Per bucket: submissions ÷ (standup entries × team members)',
    notes: [
      'This card is hidden entirely when the team runs no standups.',
      'As with attendance, the denominator uses current team size.',
    ],
  },
  memberBreakdown: {
    label: 'Member breakdown',
    summary: 'Per-person activity across the completed retros in this period.',
    notes: [
      'Retros attended counts retros the member actually joined.',
      'Cards and votes count what the member authored and cast within those retros.',
      'Visible to team leads and admins only — treat it as a conversation starter, not a performance ranking.',
    ],
  },
} satisfies Record<string, MetricExplanation>
