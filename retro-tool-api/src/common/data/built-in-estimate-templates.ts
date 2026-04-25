export interface BuiltInEstimateTemplateValue {
  label: string;
  value: string;
  order: number;
  color?: string;
  description?: string;
}

export interface BuiltInEstimateTemplate {
  id: string;
  name: string;
  description: string;
  color?: string;
  values: BuiltInEstimateTemplateValue[];
}

export const BUILT_IN_ESTIMATE_TEMPLATES: BuiltInEstimateTemplate[] = [
  {
    id: 'f1b0acc1-0000-4000-a000-000000000001',
    name: 'Fibonacci',
    description:
      'Classic story estimate scale based on Fibonacci numbers. Gaps between values grow with complexity — making it harder to agree on large estimates, which encourages breaking down stories. The gold standard for agile estimation.',
    values: [
      {
        label: '½',
        value: '0.5',
        order: 0,
        description: 'Negligible effort — a config change or one-liner',
      },
      {
        label: '1',
        value: '1',
        order: 1,
        description: 'Trivial, well understood, no surprises',
      },
      {
        label: '2',
        value: '2',
        order: 2,
        description: 'Simple change with minor complexity',
      },
      {
        label: '3',
        value: '3',
        order: 3,
        description: 'Small feature with some unknowns',
      },
      {
        label: '5',
        value: '5',
        order: 4,
        description: 'Moderate complexity, needs investigation',
      },
      {
        label: '8',
        value: '8',
        order: 5,
        description: 'Large task with significant unknowns',
      },
      {
        label: '13',
        value: '13',
        order: 6,
        description: 'Very large — consider splitting',
      },
      {
        label: '21',
        value: '21',
        order: 7,
        description: 'Epic-sized, must be decomposed',
      },
      {
        label: '34',
        value: '34',
        order: 8,
        description: 'Too large to estimate accurately',
      },
      {
        label: '55',
        value: '55',
        order: 9,
        description: 'Reserved for rough roadmap sizing',
      },
      {
        label: '89',
        value: '89',
        order: 10,
        description: 'Reserved for rough roadmap sizing',
      },
      {
        label: '∞',
        value: '∞',
        order: 11,
        description: 'Cannot estimate — needs a discovery spike',
      },
      {
        label: '?',
        value: '?',
        order: 12,
        description: 'Not enough information to vote',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000002',
    name: 'Modified Fibonacci',
    description:
      'Extended Fibonacci favored by teams that deal with larger work items. The 13→20→40→100 jumps highlight uncertainty at scale and push teams to decompose large stories.',
    values: [
      {
        label: '½',
        value: '0.5',
        order: 0,
        description: 'Negligible effort — a config change or one-liner',
      },
      {
        label: '1',
        value: '1',
        order: 1,
        description: 'Trivial, well understood, no surprises',
      },
      {
        label: '2',
        value: '2',
        order: 2,
        description: 'Simple change with minor complexity',
      },
      {
        label: '3',
        value: '3',
        order: 3,
        description: 'Small feature with some unknowns',
      },
      {
        label: '5',
        value: '5',
        order: 4,
        description: 'Moderate complexity, needs investigation',
      },
      {
        label: '8',
        value: '8',
        order: 5,
        description: 'Large task with significant unknowns',
      },
      {
        label: '13',
        value: '13',
        order: 6,
        description: 'Very large — consider splitting',
      },
      {
        label: '20',
        value: '20',
        order: 7,
        description: 'Too large, needs decomposition',
      },
      {
        label: '40',
        value: '40',
        order: 8,
        description: 'Epic-sized — very rough estimate only',
      },
      {
        label: '100',
        value: '100',
        order: 9,
        description: 'Rough roadmap sizing only',
      },
      {
        label: '∞',
        value: '∞',
        order: 10,
        description: 'Cannot estimate — needs a discovery spike',
      },
      {
        label: '?',
        value: '?',
        order: 11,
        description: 'Need more information to vote',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000003',
    name: 'Powers of 2',
    description:
      'Clean binary scale where each step doubles the previous. Relative sizing differences are unambiguous. Great for teams that prefer mathematical clarity over narrative.',
    values: [
      {
        label: '1',
        value: '1',
        order: 0,
        description: 'Trivial — minimal effort',
      },
      {
        label: '2',
        value: '2',
        order: 1,
        description: 'Simple — 2× a trivial task',
      },
      {
        label: '4',
        value: '4',
        order: 2,
        description: 'Small — 4× a trivial task',
      },
      {
        label: '8',
        value: '8',
        order: 3,
        description: 'Medium — noticeable complexity',
      },
      {
        label: '16',
        value: '16',
        order: 4,
        description: 'Large — significant effort',
      },
      {
        label: '32',
        value: '32',
        order: 5,
        description: 'Very large — consider splitting',
      },
      {
        label: '64',
        value: '64',
        order: 6,
        description: 'Epic-sized — must be decomposed',
      },
      {
        label: '?',
        value: '?',
        order: 7,
        description: 'Need more information',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000004',
    name: 'T-shirt Sizes',
    description:
      'Intuitive size-based scale using clothing metaphors. Perfect for quick feature sizing, product roadmaps, and non-technical stakeholders. Maps to Fibonacci points: XS=1, S=2, M=3, L=5, XL=8, XXL=13.',
    color: '#f43f5e',
    values: [
      {
        label: 'XS',
        value: '1',
        order: 0,
        description: 'Trivial change — a few hours of work',
      },
      {
        label: 'S',
        value: '2',
        order: 1,
        description: 'Small task — about half a day',
      },
      { label: 'M', value: '3', order: 2, description: 'Medium — 1–2 days' },
      { label: 'L', value: '5', order: 3, description: 'Large — 3–5 days' },
      {
        label: 'XL',
        value: '8',
        order: 4,
        description: 'Extra large — up to 2 weeks',
      },
      {
        label: 'XXL',
        value: '13',
        order: 5,
        description: 'Very large — needs decomposition',
      },
      {
        label: '?',
        value: '?',
        order: 6,
        description: 'Cannot estimate without more information',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000005',
    name: 'Hours',
    description:
      'Direct time estimation in hours. Best for well-scoped tasks where duration is predictable. Encourages precision but works best for sub-day stories.',
    color: '#f59e0b',
    values: [
      {
        label: '1h',
        value: '1',
        order: 0,
        description: 'One hour of focused work',
      },
      { label: '2h', value: '2', order: 1, description: 'Two hours' },
      { label: '4h', value: '4', order: 2, description: 'Half a working day' },
      {
        label: '6h',
        value: '6',
        order: 3,
        description: 'Most of a working day',
      },
      { label: '8h', value: '8', order: 4, description: 'Full working day' },
      { label: '16h', value: '16', order: 5, description: 'Two full days' },
      {
        label: '24h',
        value: '24',
        order: 6,
        description: 'Three days — consider splitting',
      },
      { label: '?', value: '?', order: 7, description: 'Duration unknown' },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000006',
    name: 'Days',
    description:
      'Estimation in whole working days. Simpler than hours for multi-day tasks. Use when hour-level precision is not needed or when planning at sprint level.',
    color: '#f97316',
    values: [
      { label: '1d', value: '1', order: 0, description: 'One working day' },
      { label: '2d', value: '2', order: 1, description: 'Two working days' },
      { label: '3d', value: '3', order: 2, description: 'Three working days' },
      { label: '5d', value: '5', order: 3, description: 'One full work week' },
      {
        label: '10d',
        value: '10',
        order: 4,
        description: 'Two weeks — consider splitting',
      },
      { label: '?', value: '?', order: 5, description: 'Duration unknown' },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000007',
    name: 'Linear (1–10)',
    description:
      'Simple 1–10 difficulty score. Each number represents relative complexity. Great for teams new to agile estimation who find Fibonacci confusing.',
    color: '#10b981',
    values: [
      {
        label: '1',
        value: '1',
        order: 0,
        description: 'Trivial — minimal effort',
      },
      { label: '2', value: '2', order: 1, description: 'Very easy' },
      { label: '3', value: '3', order: 2, description: 'Easy' },
      {
        label: '4',
        value: '4',
        order: 3,
        description: 'Below average complexity',
      },
      { label: '5', value: '5', order: 4, description: 'Average complexity' },
      {
        label: '6',
        value: '6',
        order: 5,
        description: 'Above average complexity',
      },
      { label: '7', value: '7', order: 6, description: 'Fairly complex' },
      { label: '8', value: '8', order: 7, description: 'Complex' },
      { label: '9', value: '9', order: 8, description: 'Very complex' },
      {
        label: '10',
        value: '10',
        order: 9,
        description: 'Extremely complex — consider splitting',
      },
      { label: '?', value: '?', order: 10, description: 'Need more context' },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000008',
    name: 'Dots (1–5)',
    description:
      'Visual dot notation for expressive, intuitive estimation. Ideal for workshops, roadmap reviews, and mixed technical/non-technical groups. Each dot = one unit of effort.',
    color: '#0ea5e9',
    values: [
      { label: '•', value: '1', order: 0, description: 'Minimal effort' },
      { label: '••', value: '2', order: 1, description: 'Light effort' },
      { label: '•••', value: '3', order: 2, description: 'Moderate effort' },
      {
        label: '••••',
        value: '4',
        order: 3,
        description: 'Significant effort',
      },
      {
        label: '•••••',
        value: '5',
        order: 4,
        description: 'Maximum effort in this scale',
      },
      { label: '?', value: '?', order: 5, description: 'Cannot estimate' },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000009',
    name: 'Risk',
    description:
      'Risk assessment scale for evaluating uncertainty, impact, and delivery confidence. Use alongside story points to flag stories that need more investigation before committing.',
    values: [
      {
        label: 'Low',
        value: '1',
        order: 0,
        color: '#22c55e',
        description: 'Well understood, minimal unknowns, minimal risk',
      },
      {
        label: 'Medium',
        value: '2',
        order: 1,
        color: '#f59e0b',
        description: 'Some unknowns, manageable with standard practices',
      },
      {
        label: 'High',
        value: '3',
        order: 2,
        color: '#ef4444',
        description: 'Significant unknowns, requires careful planning or spike',
      },
      {
        label: 'Critical',
        value: '4',
        order: 3,
        color: '#7c3aed',
        description: 'Highly uncertain — escalate, spike, or descope',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000010',
    name: 'Team Confidence',
    description:
      'Team confidence score measuring how certain the team feels about successfully delivering a story. Pair with complexity estimates to surface hidden risk. Low confidence = needs discussion before committing.',
    color: '#14b8a6',
    values: [
      {
        label: '1',
        value: '1',
        order: 0,
        description: 'Very low confidence — many unknowns or blockers',
      },
      {
        label: '2',
        value: '2',
        order: 1,
        description: 'Low confidence — significant questions remain',
      },
      {
        label: '3',
        value: '3',
        order: 2,
        description: 'Moderate confidence — some open questions',
      },
      {
        label: '4',
        value: '4',
        order: 3,
        description: 'High confidence — minor questions only',
      },
      {
        label: '5',
        value: '5',
        order: 4,
        description: 'Full confidence — well understood, ready to go',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000011',
    name: 'Easy / Medium / Hard',
    description:
      'Simple 3-point difficulty scale. Great for quick scoping, non-technical teams, or early backlog triage when you just need a rough cut. Each level maps to a Fibonacci range: Easy=1, Medium=3, Hard=8.',
    values: [
      {
        label: 'Easy',
        value: '1',
        order: 0,
        color: '#22c55e',
        description: 'Simple, minimal effort — a few hours at most',
      },
      {
        label: 'Medium',
        value: '3',
        order: 1,
        color: '#f59e0b',
        description: 'Moderate effort, some complexity or unknowns',
      },
      {
        label: 'Hard',
        value: '8',
        order: 2,
        color: '#ef4444',
        description: 'Complex, high effort — consider breaking down',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000012',
    name: 'Classic Story Estimate',
    description:
      'The most widely used story estimate scale. Starts at 0 for trivial no-ops and tops out at 100 for very rough epic sizing. The standard scale found in most agile estimation kits.',
    color: '#8b5cf6',
    values: [
      {
        label: '0',
        value: '0',
        order: 0,
        description: 'No effort — already done or a trivial no-op',
      },
      {
        label: '1',
        value: '1',
        order: 1,
        description: 'Trivial, well understood',
      },
      {
        label: '2',
        value: '2',
        order: 2,
        description: 'Simple, minor complexity',
      },
      { label: '3', value: '3', order: 3, description: 'Small, some unknowns' },
      { label: '5', value: '5', order: 4, description: 'Moderate complexity' },
      {
        label: '8',
        value: '8',
        order: 5,
        description: 'Large, significant unknowns',
      },
      {
        label: '13',
        value: '13',
        order: 6,
        description: 'Very large — consider splitting',
      },
      {
        label: '20',
        value: '20',
        order: 7,
        description: 'Too large, needs decomposition',
      },
      { label: '40', value: '40', order: 8, description: 'Epic-sized' },
      {
        label: '100',
        value: '100',
        order: 9,
        description: 'Rough roadmap sizing only',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000013',
    name: 'Fibonacci with Coffee',
    description:
      "Extended story estimate scale with two special cards. '?' means the team needs more information before estimating. '☕' signals the item is too large and the team needs a break or a splitting session. The most expressive Fibonacci deck.",
    color: '#d946ef',
    values: [
      {
        label: '0',
        value: '0',
        order: 0,
        description: 'No effort — already done or trivial no-op',
      },
      {
        label: '½',
        value: '0.5',
        order: 1,
        description: 'Negligible, under an hour',
      },
      {
        label: '1',
        value: '1',
        order: 2,
        description: 'Trivial, well understood',
      },
      {
        label: '2',
        value: '2',
        order: 3,
        description: 'Simple, minor complexity',
      },
      { label: '3', value: '3', order: 4, description: 'Small, some unknowns' },
      { label: '5', value: '5', order: 5, description: 'Moderate complexity' },
      {
        label: '8',
        value: '8',
        order: 6,
        description: 'Large, significant unknowns',
      },
      {
        label: '13',
        value: '13',
        order: 7,
        description: 'Very large — consider splitting',
      },
      {
        label: '20',
        value: '20',
        order: 8,
        description: 'Too large, needs decomposition',
      },
      { label: '40', value: '40', order: 9, description: 'Epic-sized' },
      {
        label: '100',
        value: '100',
        order: 10,
        description: 'Rough roadmap sizing only',
      },
      {
        label: '?',
        value: '?',
        order: 11,
        description: 'Need more information before estimating',
      },
      {
        label: '☕',
        value: '☕',
        order: 12,
        description: 'Too complex — take a break and split the story',
      },
    ],
  },
  {
    id: 'f1b0acc1-0000-4000-a000-000000000014',
    name: 'Linear (1–7)',
    description:
      'Compact linear scale for teams that want simplicity without the gaps of Fibonacci. Seven distinct values cover the full range from trivial to very complex without overwhelming participants.',
    color: '#0284c7',
    values: [
      {
        label: '1',
        value: '1',
        order: 0,
        description: 'Trivial — minimal effort',
      },
      { label: '2', value: '2', order: 1, description: 'Easy' },
      { label: '3', value: '3', order: 2, description: 'Moderate' },
      { label: '4', value: '4', order: 3, description: 'Average complexity' },
      { label: '5', value: '5', order: 4, description: 'Fairly complex' },
      { label: '6', value: '6', order: 5, description: 'Complex' },
      {
        label: '7',
        value: '7',
        order: 6,
        description: 'Very complex — consider splitting',
      },
    ],
  },
];
