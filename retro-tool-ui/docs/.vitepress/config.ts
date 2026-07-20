import { defineConfig } from 'vitepress'

// The user guide is served same-origin from the SPA at `/docs`. It is built as
// a standalone VitePress site whose output is emitted INTO the SPA's Vite build
// output (`dist/docs`), so a single Azure Static Web App artifact serves both
// the app (`/`) and the guide (`/docs`). The SWA `navigationFallback.exclude`
// (see public/staticwebapp.config.json) keeps `/docs/*` from being rewritten to
// the SPA's index.html.
export default defineConfig({
  title: 'Retro-Tool Guide',
  description:
    'User guide for Retro-Tool — retrospectives, story estimates, and more.',
  // Served under /docs; prepended to all absolute (root-relative) asset URLs.
  base: '/docs/',
  // Emit into the SPA build output so one deploy ships both.
  outDir: '../dist/docs',
  cleanUrls: true,
  themeConfig: {
    // Client-side full-text search over all pages. `local` needs no external
    // service — the index is built at compile time and shipped as static JSON.
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Features',
        items: [
          { text: 'Retrospectives', link: '/retrospectives/' },
          { text: 'Story Estimates', link: '/story-estimates/' },
          { text: 'Standups', link: '/standups/' },
          { text: 'Icebreakers', link: '/icebreakers/' },
          { text: 'Polls', link: '/polls/' },
          { text: 'Surveys', link: '/surveys/' },
        ],
      },
    ],
    sidebar: {
      '/retrospectives/': [
        {
          text: 'Retrospectives',
          items: [
            { text: 'Overview', link: '/retrospectives/' },
            {
              text: 'Creating a retrospective',
              link: '/retrospectives/creating-a-retro',
            },
            {
              text: 'The board and phases',
              link: '/retrospectives/the-board-and-phases',
            },
            {
              text: 'Organizing the list',
              link: '/retrospectives/organizing-the-list',
            },
            {
              text: 'Adding and grouping cards',
              link: '/retrospectives/adding-and-grouping-cards',
            },
            { text: 'Voting', link: '/retrospectives/voting' },
            {
              text: 'Discussion and action items',
              link: '/retrospectives/discussion-and-action-items',
            },
            {
              text: 'Report and sharing',
              link: '/retrospectives/report-and-sharing',
            },
            {
              text: 'Roles and permissions',
              link: '/retrospectives/roles-and-permissions',
            },
          ],
        },
      ],
      '/story-estimates/': [
        {
          text: 'Story Estimates',
          items: [
            { text: 'Overview', link: '/story-estimates/' },
            {
              text: 'Creating a session',
              link: '/story-estimates/creating-a-session',
            },
            {
              text: 'Organizing the list',
              link: '/story-estimates/organizing-the-list',
            },
            { text: 'Voting', link: '/story-estimates/voting' },
            {
              text: 'Revealing votes & consensus',
              link: '/story-estimates/revealing-and-consensus',
            },
            { text: 'Running rounds', link: '/story-estimates/running-rounds' },
            {
              text: 'Report & sharing',
              link: '/story-estimates/report-and-sharing',
            },
            {
              text: 'Roles & permissions',
              link: '/story-estimates/roles-and-permissions',
            },
          ],
        },
      ],
      '/standups/': [
        {
          text: 'Standups',
          items: [
            { text: 'Overview', link: '/standups/' },
            {
              text: 'Creating a standup',
              link: '/standups/creating-a-standup',
            },
            {
              text: 'Submitting your update',
              link: '/standups/submitting-your-update',
            },
            {
              text: 'Comments and reactions',
              link: '/standups/comments-and-reactions',
            },
            {
              text: 'Calendar and skipped days',
              link: '/standups/calendar-and-skipped-days',
            },
            {
              text: 'Reports and sharing',
              link: '/standups/reports-and-sharing',
            },
            {
              text: 'Roles and permissions',
              link: '/standups/roles-and-permissions',
            },
          ],
        },
      ],
      '/icebreakers/': [
        {
          text: 'Icebreakers',
          items: [
            { text: 'Overview', link: '/icebreakers/' },
            {
              text: 'Starting an icebreaker',
              link: '/icebreakers/starting-an-icebreaker',
            },
            { text: 'Swiping prompts', link: '/icebreakers/swiping-prompts' },
            {
              text: 'Reactions and celebration',
              link: '/icebreakers/reactions-and-celebration',
            },
            { text: 'Ending a session', link: '/icebreakers/ending-a-session' },
            {
              text: 'Roles and permissions',
              link: '/icebreakers/roles-and-permissions',
            },
          ],
        },
      ],
      '/polls/': [
        {
          text: 'Polls',
          items: [
            { text: 'Overview', link: '/polls/' },
            { text: 'Creating a poll', link: '/polls/creating-a-poll' },
            { text: 'Voting', link: '/polls/voting' },
            {
              text: 'Results & anonymity',
              link: '/polls/results-and-anonymity',
            },
            { text: 'Managing a poll', link: '/polls/managing-a-poll' },
          ],
        },
      ],
      '/surveys/': [
        {
          text: 'Surveys',
          items: [
            { text: 'Overview', link: '/surveys/' },
            { text: 'Creating a survey', link: '/surveys/creating-a-survey' },
            { text: 'Question types', link: '/surveys/question-types' },
            {
              text: 'Responding to a survey',
              link: '/surveys/responding-to-a-survey',
            },
            {
              text: 'Results and reports',
              link: '/surveys/results-and-reports',
            },
            {
              text: 'Roles and permissions',
              link: '/surveys/roles-and-permissions',
            },
          ],
        },
      ],
    },
  },
})
