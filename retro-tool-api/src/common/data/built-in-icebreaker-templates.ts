import {
  ICEBREAKER_FLAVOURS,
  type TIcebreakerFlavour,
} from '../enums/icebreaker.enums';

export interface BuiltInIcebreakerPrompt {
  text: string;
  order: number;
  color?: string;
}

export interface BuiltInIcebreakerTemplate {
  id: string;
  name: string;
  description: string;
  flavour: TIcebreakerFlavour;
  color?: string;
  prompts: BuiltInIcebreakerPrompt[];
}

export const BUILT_IN_ICEBREAKER_TEMPLATES: BuiltInIcebreakerTemplate[] = [
  {
    id: '1ceb0001-0000-4000-a000-000000000001',
    name: 'Two Truths and a Lie',
    description:
      'A classic warm-up: each person shares three statements about themselves and the team guesses which one is the lie. Great for new and established teams alike.',
    flavour: ICEBREAKER_FLAVOURS.Fun,
    color: '#f59e0b',
    prompts: [
      { text: 'Share two truths and one lie about yourself.', order: 0 },
      { text: 'What is the most unusual job you have ever had?', order: 1 },
      {
        text: 'Which country would you move to tomorrow if you could?',
        order: 2,
      },
      { text: 'What is a hidden talent nobody here knows about?', order: 3 },
      { text: 'What is the strangest food you have ever enjoyed?', order: 4 },
      {
        text: 'If you could instantly master one skill, what would it be?',
        order: 5,
      },
    ],
  },
  {
    id: '1ceb0002-0000-4000-a000-000000000002',
    name: 'Quick Fire Fun',
    description:
      'Light, fast, low-stakes questions to get everyone talking and laughing before the real work begins.',
    flavour: ICEBREAKER_FLAVOURS.Fun,
    color: '#ec4899',
    prompts: [
      { text: 'Coffee, tea, or something else entirely?', order: 0 },
      { text: 'What song is stuck in your head right now?', order: 1 },
      { text: 'Cats, dogs, or neither?', order: 2 },
      { text: "What's your go-to comfort movie?", order: 3 },
      { text: 'Beach holiday or mountain adventure?', order: 4 },
      { text: 'What emoji best describes your week so far?', order: 5 },
      { text: 'Sweet or savoury snacks?', order: 6 },
    ],
  },
  {
    id: '1ceb0003-0000-4000-a000-000000000003',
    name: 'Sprint Reflections',
    description:
      'Professional prompts that warm the team up while gently steering thoughts toward collaboration and delivery.',
    flavour: ICEBREAKER_FLAVOURS.Professional,
    color: '#3b82f6',
    prompts: [
      { text: 'What was your proudest win this sprint?', order: 0 },
      {
        text: 'What is one thing that made your work easier recently?',
        order: 1,
      },
      { text: 'Who on the team would you like to thank, and why?', order: 2 },
      { text: 'What is one skill you want to grow this quarter?', order: 3 },
      {
        text: 'What is a small process change that would help you most?',
        order: 4,
      },
      { text: 'What did you learn this week that surprised you?', order: 5 },
    ],
  },
  {
    id: '1ceb0004-0000-4000-a000-000000000004',
    name: 'Ways of Working',
    description:
      'Professional prompts to surface working preferences and build mutual understanding across the team.',
    flavour: ICEBREAKER_FLAVOURS.Professional,
    color: '#0ea5e9',
    prompts: [
      { text: 'When do you do your best focused work?', order: 0 },
      { text: 'How do you prefer to receive feedback?', order: 1 },
      { text: 'What helps you feel unblocked when you are stuck?', order: 2 },
      { text: 'What does a great meeting look like to you?', order: 3 },
      { text: 'How do you like to celebrate a shipped feature?', order: 4 },
    ],
  },
  {
    id: '1ceb0005-0000-4000-a000-000000000005',
    name: 'Imagination Station',
    description:
      'Creative, open-ended prompts that spark imagination and reveal a more playful side of the team.',
    flavour: ICEBREAKER_FLAVOURS.Creative,
    color: '#8b5cf6',
    prompts: [
      { text: 'If your week were a movie title, what would it be?', order: 0 },
      {
        text: 'You can have dinner with any fictional character — who?',
        order: 1,
      },
      {
        text: 'Invent a brand-new public holiday. What do we celebrate?',
        order: 2,
      },
      {
        text: 'If your mood were a weather forecast, what is today?',
        order: 3,
      },
      { text: 'What superpower would make your job easier?', order: 4 },
      { text: 'Describe your ideal workspace on another planet.', order: 5 },
    ],
  },
  {
    id: '1ceb0006-0000-4000-a000-000000000006',
    name: 'Story Sparks',
    description:
      'Creative storytelling prompts to get the team thinking laterally and sharing something memorable.',
    flavour: ICEBREAKER_FLAVOURS.Creative,
    color: '#a855f7',
    prompts: [
      { text: 'Tell us about a small adventure from your weekend.', order: 0 },
      { text: 'What is the best gift you have ever given someone?', order: 1 },
      { text: 'Describe a place that always makes you feel calm.', order: 2 },
      {
        text: 'What is a book, show, or game you would recommend right now?',
        order: 3,
      },
      { text: 'Share a tiny victory you had this week.', order: 4 },
    ],
  },
];
