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

  // ── Extended ───────────────────────────────────────────────────────────────

  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Rose / Bud / Thorn',
    description:
      'A nature-inspired format that balances reflection on positives, opportunities, and pain points — great for teams wanting a gentle, creative retrospective.',
    columns: [
      {
        name: 'Roses',
        emoji: '🌹',
        prompt: 'What went well and deserves recognition?',
        order: 0,
      },
      {
        name: 'Buds',
        emoji: '🌱',
        prompt: 'What opportunities or improvements are you excited about?',
        order: 1,
      },
      {
        name: 'Thorns',
        emoji: '🌵',
        prompt: 'What pain points or problems need addressing?',
        order: 2,
      },
    ],
  },

  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    name: 'Plus / Delta',
    description:
      'A simple two-column format borrowed from agile coaching. Focus on what to preserve and what to change — no blame, just improvement.',
    columns: [
      {
        name: 'Plus',
        emoji: '➕',
        prompt: 'What did we do well that we should continue?',
        order: 0,
      },
      {
        name: 'Delta',
        emoji: '🔺',
        prompt: 'What should we change or improve next sprint?',
        order: 1,
      },
    ],
  },

  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    name: 'FLAP',
    description:
      'A four-quadrant format that looks back and forward: Future considerations, Lessons learned, Accomplishments, and Problem areas.',
    columns: [
      {
        name: 'Future Considerations',
        emoji: '🔭',
        prompt: 'What upcoming risks or events should we plan for?',
        order: 0,
      },
      {
        name: 'Lessons Learned',
        emoji: '📖',
        prompt: 'What did we learn this sprint that we should carry forward?',
        order: 1,
      },
      {
        name: 'Accomplishments',
        emoji: '🏆',
        prompt: 'What are we proud of achieving this sprint?',
        order: 2,
      },
      {
        name: 'Problem Areas',
        emoji: '🚧',
        prompt: 'What problems slowed us down or caused friction?',
        order: 3,
      },
    ],
  },

  {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    name: 'Speed Car',
    description:
      'A metaphor-driven format: the engine powers the team, the parachute slows it, the cliff represents risk, and the bridge is the goal ahead.',
    columns: [
      {
        name: 'Engine',
        emoji: '🚀',
        prompt: 'What is driving us forward and giving us momentum?',
        order: 0,
      },
      {
        name: 'Parachute',
        emoji: '🪂',
        prompt: 'What is slowing us down or reducing our velocity?',
        order: 1,
      },
      {
        name: 'Cliff',
        emoji: '⚠️',
        prompt: 'What risks or blockers could derail us if left unaddressed?',
        order: 2,
      },
      {
        name: 'Bridge',
        emoji: '🌉',
        prompt: 'What is our destination or north-star goal?',
        order: 3,
      },
    ],
  },

  {
    id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    name: 'Starfish',
    description:
      'A five-armed format that gives nuanced directional feedback — not just stop/start, but also more, less, and keep — for rich team discussions.',
    columns: [
      {
        name: 'Keep Doing',
        emoji: '⭐',
        prompt: 'What practices should we preserve exactly as they are?',
        order: 0,
      },
      {
        name: 'Stop Doing',
        emoji: '🛑',
        prompt: 'What should we stop entirely because it adds no value?',
        order: 1,
      },
      {
        name: 'Start Doing',
        emoji: '🚀',
        prompt: 'What new practice should we introduce next sprint?',
        order: 2,
      },
      {
        name: 'More Of',
        emoji: '📈',
        prompt: 'What is working but deserves even more attention or effort?',
        order: 3,
      },
      {
        name: 'Less Of',
        emoji: '📉',
        prompt:
          'What is partially useful but is taking up too much time or energy?',
        order: 4,
      },
    ],
  },
];
