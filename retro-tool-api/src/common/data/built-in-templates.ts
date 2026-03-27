export interface BuiltInTemplateColumn {
  name: string;
  emoji: string;
  prompt: string;
  order: number;
}

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  columns: BuiltInTemplateColumn[];
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // ── Classic ────────────────────────────────────────────────────────────────

  {
    id: '23b0f9a2-c33d-4f2d-bec7-95f11f267a41',
    name: '4Ls',
    description:
      'Four simple words to dig into both positive and negative aspects of your last Sprint. The Ls stand for: Liked, Learned, Lacked, and Longed For.',
    columns: [
      {
        name: 'Liked',
        emoji: '❤️',
        prompt: 'Things you really enjoyed',
        order: 0,
      },
      {
        name: 'Learned',
        emoji: '📚',
        prompt: 'Things you have learned',
        order: 1,
      },
      {
        name: 'Lacked',
        emoji: '⚠️',
        prompt: 'Things the team missed',
        order: 2,
      },
      {
        name: 'Longed For',
        emoji: '🌟',
        prompt: 'Something you wished for',
        order: 3,
      },
    ],
  },

  {
    id: 'd6f467bb-a57b-4a23-bf7e-2fdf26f5b4ea',
    name: 'Appreciation Game',
    description:
      "A short activity based on the good things your team members did! Reinforce your team's relationship and its velocity.",
    columns: [
      {
        name: 'Team Spirit',
        emoji: '🤝',
        prompt: 'You really served the team when…',
        order: 0,
      },
      {
        name: 'Ideas',
        emoji: '💡',
        prompt: 'What I would like to see more of',
        order: 1,
      },
    ],
  },

  {
    id: '8755894f-a4d6-4f31-a2db-d84dd07eb4db',
    name: "Cupid's Retrospective",
    description:
      'Spread the love at your retrospective! Strengthen bonds and accentuate recognition within the team.',
    columns: [
      {
        name: 'Self-love',
        emoji: '💜',
        prompt: 'Tell us how you made a difference',
        order: 0,
      },
      {
        name: 'Good Stuff!',
        emoji: '👍',
        prompt: 'What did you like about the last Sprint/project?',
        order: 1,
      },
      {
        name: 'My Wishes',
        emoji: '🌠',
        prompt: 'What are your wishes for the team?',
        order: 2,
      },
      {
        name: 'A Team to Die For',
        emoji: '💕',
        prompt: 'Share sweet words about your teammates',
        order: 3,
      },
    ],
  },

  // ── New ────────────────────────────────────────────────────────────────────

  {
    id: '5f24f2ee-dd67-4109-9efe-5c6e34b8cfaa',
    name: 'Start / Stop / Continue',
    description:
      'A simple, actionable format that drives immediate change. The team identifies behaviours to adopt, drop, and keep.',
    columns: [
      {
        name: 'Start',
        emoji: '🚀',
        prompt: 'What should the team start doing?',
        order: 0,
      },
      {
        name: 'Stop',
        emoji: '🛑',
        prompt: 'What is slowing the team down or causing friction?',
        order: 1,
      },
      {
        name: 'Continue',
        emoji: '✅',
        prompt: 'What is working well that we should keep doing?',
        order: 2,
      },
    ],
  },

  {
    id: '99eea2f2-ea5f-4f76-ae40-4b1756fe4dee',
    name: 'Mad / Sad / Glad',
    description:
      'An emotion-first retrospective that surfaces how the team truly feels, building psychological safety through honest expression.',
    columns: [
      {
        name: 'Mad',
        emoji: '😤',
        prompt: 'What frustrated or angered you this sprint?',
        order: 0,
      },
      {
        name: 'Sad',
        emoji: '😢',
        prompt: 'What disappointed you or left you feeling deflated?',
        order: 1,
      },
      {
        name: 'Glad',
        emoji: '😄',
        prompt: 'What made you happy or proud?',
        order: 2,
      },
    ],
  },

  {
    id: 'f6cb6358-b4b4-4b35-890f-14b5f45eb2a7',
    name: 'Sailboat',
    description:
      'A visual metaphor where the team is a sailboat. Winds push it forward, anchors hold it back, rocks ahead are risks, and the island is the goal.',
    columns: [
      {
        name: 'Wind',
        emoji: '💨',
        prompt: 'What is propelling us forward?',
        order: 0,
      },
      {
        name: 'Anchor',
        emoji: '⚓',
        prompt: 'What is holding us back?',
        order: 1,
      },
      {
        name: 'Rocks',
        emoji: '🪨',
        prompt: 'What risks or obstacles lie ahead?',
        order: 2,
      },
      {
        name: 'Island',
        emoji: '🏝️',
        prompt: 'What is our goal or north star?',
        order: 3,
      },
    ],
  },

  {
    id: '72d051f8-a0b6-4c75-9816-460e87fef90c',
    name: 'DAKI',
    description:
      'Drop, Add, Keep, Improve — a four-quadrant format that drives concrete, measurable change from every retrospective.',
    columns: [
      {
        name: 'Drop',
        emoji: '🗑️',
        prompt: 'What should we stop doing completely?',
        order: 0,
      },
      {
        name: 'Add',
        emoji: '➕',
        prompt: 'What new practice or tool should we introduce?',
        order: 1,
      },
      {
        name: 'Keep',
        emoji: '🔒',
        prompt: 'What is working so well we must protect it?',
        order: 2,
      },
      {
        name: 'Improve',
        emoji: '🔧',
        prompt: 'What exists but needs to be refined or done better?',
        order: 3,
      },
    ],
  },

  {
    id: '8dbf849d-65f4-4b76-bca8-8d7ce117f8f7',
    name: '5 Whys',
    description:
      'A root-cause analysis format. The team surfaces a problem, drills down through five layers of "why", and commits to a fix.',
    columns: [
      {
        name: 'Problem',
        emoji: '🐛',
        prompt: 'What went wrong this sprint?',
        order: 0,
      },
      { name: 'Why #1', emoji: '❓', prompt: 'Why did that happen?', order: 1 },
      {
        name: 'Why #2',
        emoji: '❓',
        prompt: 'Why did the cause above occur?',
        order: 2,
      },
      {
        name: 'Why #3–5',
        emoji: '🔍',
        prompt: 'Keep asking why until you reach the root cause',
        order: 3,
      },
      {
        name: 'Action',
        emoji: '✍️',
        prompt: 'What concrete step will prevent this from happening again?',
        order: 4,
      },
    ],
  },
];
