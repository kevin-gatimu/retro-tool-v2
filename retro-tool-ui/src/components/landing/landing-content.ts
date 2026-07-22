import {
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Cpu,
  GitBranch,
  Globe,
  Hash,
  Layers,
  ListTodo,
  MessageSquare,
  Music,
  Radio,
  Shield,
  Star,
  Timer,
  TrendingUp,
  ThumbsUp,
  Users,
} from 'lucide-react'

// ─── Data ──────────────────────────────────────────────────────────────────────

export const STATS = [
  { value: '500+', label: 'Teams Deployed' },
  { value: '12K+', label: 'Retros Executed' },
  { value: '98%', label: 'Mission Success' },
  { value: '6', label: 'Template Formats' },
]

export const CORE_FEATURES = [
  {
    icon: Radio,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    border: 'hover:border-emerald-500/40',
    title: 'Real-Time Collaboration',
    description:
      'Cards appear live as teammates write them. WebSocket-powered sync means no refresh, no lag — just flow.',
    badge: 'LIVE',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: GitBranch,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
    border: 'hover:border-cyan-500/40',
    title: 'Multi-Org RBAC',
    description:
      'Super-admin, system admin, org admin, team lead, member — granular control across every layer of your organization.',
    badge: 'ENTERPRISE',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    border: 'hover:border-violet-500/40',
    title: 'Analytics & Reports',
    description:
      'Team health scores, action item completion rates, template usage metrics. Data that drives continuous improvement.',
    badge: 'INSIGHTS',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  },
  {
    icon: Cpu,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    border: 'hover:border-amber-500/40',
    title: 'Story Estimates',
    description:
      'Built-in estimation sessions with real-time voting, consensus detection, and result broadcasting to the whole team.',
    badge: 'ESTIMATES',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    icon: Bell,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
    border: 'hover:border-rose-500/40',
    title: 'Smart Notifications',
    description:
      'In-app, email, push, and weekly digest notifications. Retro reminders 1 hour before sessions. Never miss a beat.',
    badge: 'PUSH',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    icon: Shield,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
    glow: 'hover:shadow-[0_0_30px_rgba(20,184,166,0.15)]',
    border: 'hover:border-teal-500/40',
    title: 'Microsoft SSO',
    description:
      'Enterprise-grade authentication via Microsoft OAuth. Cookie-based sessions, secure token handling, approval workflows.',
    badge: 'SECURE',
    badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  },
]

export const TEMPLATES = [
  {
    name: 'Start, Stop, Continue',
    desc: 'Identify what to change and what to keep',
    category: 'Classic',
    accent: 'border-emerald-500/30 hover:border-emerald-500/60',
    dot: 'bg-emerald-500',
    tag: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    name: '4Ls Retrospective',
    desc: 'Liked, Learned, Lacked, Longed For',
    category: 'Classic',
    accent: 'border-emerald-500/30 hover:border-emerald-500/60',
    dot: 'bg-emerald-500',
    tag: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    name: 'Mad, Sad, Glad',
    desc: 'Emotional check-in for team sentiment',
    category: 'Emotional',
    accent: 'border-rose-500/30 hover:border-rose-500/60',
    dot: 'bg-rose-500',
    tag: 'bg-rose-500/10 text-rose-400',
  },
  {
    name: 'Sailboat',
    desc: 'Visual metaphor for team progress',
    category: 'Visual',
    accent: 'border-cyan-500/30 hover:border-cyan-500/60',
    dot: 'bg-cyan-500',
    tag: 'bg-cyan-500/10 text-cyan-400',
  },
  {
    name: 'DAKI',
    desc: 'Drop, Add, Keep, Improve',
    category: 'Action',
    accent: 'border-amber-500/30 hover:border-amber-500/60',
    dot: 'bg-amber-500',
    tag: 'bg-amber-500/10 text-amber-400',
  },
  {
    name: 'Custom Template',
    desc: 'Build your own format from scratch',
    category: 'Custom',
    accent: 'border-violet-500/30 hover:border-violet-500/60',
    dot: 'bg-violet-500',
    tag: 'bg-violet-500/10 text-violet-400',
  },
]

export const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Layers,
    title: 'Choose Your Format',
    desc: 'Pick from 6 battle-tested retrospective templates or build a custom format that fits your workflow.',
  },
  {
    step: '02',
    icon: MessageSquare,
    title: 'Collaborate Live',
    desc: 'Team submits cards in real-time. Vote, discuss, and mark cards as you go — all synchronized instantly.',
  },
  {
    step: '03',
    icon: ListTodo,
    title: 'Own Your Actions',
    desc: 'Convert insights into tracked action items. Carry forward unresolved items to the next sprint automatically.',
  },
]

export const ESTIMATION_PERKS = [
  {
    icon: Hash,
    title: 'Flexible Scales',
    desc: 'Fibonacci, T-shirt sizes, or powers of 2 — pick what fits your team.',
  },
  {
    icon: Users,
    title: 'Anonymous Voting',
    desc: 'Votes stay hidden until everyone commits. No anchoring bias.',
  },
  {
    icon: TrendingUp,
    title: 'Consensus Detection',
    desc: 'Auto-highlights agreement and surfaces outlier votes for discussion.',
  },
  {
    icon: ThumbsUp,
    title: 'Instant Broadcast',
    desc: 'Flip the reveal and all votes animate into view simultaneously.',
  },
]

export const EXTRA_FEATURES = [
  { icon: Timer, text: 'Time-boxed discussions with built-in timer' },
  { icon: Music, text: 'Focus music player during retro sessions' },
  { icon: CalendarClock, text: 'Scheduled retros with automatic reminders' },
  { icon: Globe, text: 'Cross-timezone team support' },
  { icon: Star, text: 'Health score tracking per team' },
  { icon: CheckCircle2, text: 'Carry-forward unresolved cards' },
]

// ─── Nanite cursor ────────────────────────────────────────────────────────────

export const TRAIL_LEN = 14
