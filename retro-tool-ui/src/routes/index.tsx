import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  FileText,
  Lock,
  Zap,
  Shield,
  BarChart3,
  Bell,
  Layers,
  Radio,
  GitBranch,
  CalendarClock,
  Music,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Globe,
  MessageSquare,
  ListTodo,
  Timer,
  Star,
  Hash,
  Users,
  TrendingUp,
  ThumbsUp,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function LandingPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#050d14' }}>
      {/* Navbar */}
      <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between">
        <Skeleton className="h-7 w-32 bg-white/10" />
        <div className="flex gap-3">
          <Skeleton className="h-8 w-16 bg-white/10" />
          <Skeleton className="h-8 w-20 bg-white/10" />
        </div>
      </div>
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 px-6 pt-24 pb-16 text-center">
        <Skeleton className="h-6 w-48 rounded-full bg-white/10" />
        <Skeleton className="h-12 w-[520px] max-w-full bg-white/10" />
        <Skeleton className="h-12 w-[420px] max-w-full bg-white/10" />
        <Skeleton className="h-5 w-96 max-w-full bg-white/10" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-11 w-36 rounded-md bg-white/10" />
          <Skeleton className="h-11 w-32 rounded-md bg-white/10" />
        </div>
        <Skeleton className="mt-8 h-64 w-full max-w-3xl rounded-xl bg-white/5" />
      </div>
      {/* Stats bar */}
      <div className="flex justify-around px-6 py-8 border-y border-white/5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-24 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/10" />
          </div>
        ))}
      </div>
      {/* Features grid */}
      <div className="px-6 py-16 space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <Skeleton className="h-5 w-80 bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/5 p-6 space-y-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
              <Skeleton className="h-5 w-32 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  pendingComponent: LandingPageSkeleton,
  component: LandingPage,
})

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '500+', label: 'Teams Deployed' },
  { value: '12K+', label: 'Retros Executed' },
  { value: '98%', label: 'Mission Success' },
  { value: '6', label: 'Template Formats' },
]

const CORE_FEATURES = [
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

const TEMPLATES = [
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

const HOW_IT_WORKS = [
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

const ESTIMATION_PERKS = [
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

const EXTRA_FEATURES = [
  { icon: Timer, text: 'Time-boxed discussions with built-in timer' },
  { icon: Music, text: 'Focus music player during retro sessions' },
  { icon: CalendarClock, text: 'Scheduled retros with automatic reminders' },
  { icon: Globe, text: 'Cross-timezone team support' },
  { icon: Star, text: 'Health score tracking per team' },
  { icon: CheckCircle2, text: 'Carry-forward unresolved cards' },
]

// ─── Nanite cursor ────────────────────────────────────────────────────────────

const TRAIL_LEN = 14

interface Nanite {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  orbitRadius: number
  orbitAngle: number
  orbitSpeed: number
  lag: number
  alpha: number
  color: string
  pulseOffset: number
  trail: { x: number; y: number }[]
}

function NaniteCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return

    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: -500, y: -500, active: false }
    let idleTimer: ReturnType<typeof setTimeout>

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        mouse.active = false
      }, 2000)
    }
    window.addEventListener('mousemove', onMove)

    const COUNT = 28
    const COLORS = [
      '#10b981',
      '#10b981',
      '#10b981',
      '#06b6d4',
      '#34d399',
      '#06b6d4',
    ]

    const nanites: Nanite[] = Array.from({ length: COUNT }, (_, i) => ({
      x: -500,
      y: -500,
      vx: 0,
      vy: 0,
      size: 1.2 + Math.random() * 2,
      orbitRadius: i < 10 ? 6 + Math.random() * 14 : 18 + Math.random() * 32,
      orbitAngle: (i / COUNT) * Math.PI * 2 + Math.random() * 0.5,
      orbitSpeed:
        (0.008 + Math.random() * 0.018) * (Math.random() < 0.5 ? 1 : -1),
      lag: i < 10 ? 0.14 + Math.random() * 0.12 : 0.06 + Math.random() * 0.08,
      alpha: 0.5 + Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulseOffset: Math.random() * Math.PI * 2,
      trail: [],
    }))

    let frame = 0
    let globalAlpha = 0
    let rafId: number

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      frame++

      const targetAlpha = mouse.active ? 1 : 0
      globalAlpha += (targetAlpha - globalAlpha) * 0.04

      // Full clear every frame — trails are drawn from position history
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (globalAlpha < 0.01) return

      // ── Update physics & record trail ──────────────────────────────────────
      nanites.forEach((n) => {
        n.orbitAngle += n.orbitSpeed
        const breathe = 1 + 0.18 * Math.sin(frame * 0.025 + n.pulseOffset)
        const r = n.orbitRadius * breathe
        const tx = mouse.x + Math.cos(n.orbitAngle) * r
        const ty = mouse.y + Math.sin(n.orbitAngle) * r

        n.vx += (tx - n.x) * n.lag
        n.vy += (ty - n.y) * n.lag
        n.vx *= 0.72
        n.vy *= 0.72

        // Snapshot before moving — trail holds where particle was
        n.trail.unshift({ x: n.x, y: n.y })
        if (n.trail.length > TRAIL_LEN) n.trail.pop()

        n.x += n.vx
        n.y += n.vy
      })

      // ── Draw smoky trails (oldest → newest so newer sits on top) ──────────
      nanites.forEach((n) => {
        for (let i = n.trail.length - 1; i >= 0; i--) {
          const pos = n.trail[i]
          // age 1 = oldest, 0 = newest
          const age = (i + 1) / TRAIL_LEN
          // Quadratic fade — fast at first, lingers then vanishes
          const fadeAlpha = globalAlpha * n.alpha * (1 - age) * (1 - age) * 0.55
          // Spread outward as it ages — the "smoke diffuse" look
          const spread = n.size * (1 + age * 3.5)

          const grad = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            spread,
          )
          grad.addColorStop(0, n.color + 'bb')
          grad.addColorStop(0.4, n.color + '44')
          grad.addColorStop(1, 'transparent')

          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, spread, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      })

      // ── Draw live nanite cores ─────────────────────────────────────────────
      nanites.forEach((n) => {
        // Core dot
        ctx.globalAlpha = globalAlpha * n.alpha
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()

        // Glow halo
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4)
        glow.addColorStop(0, n.color + '66')
        glow.addColorStop(1, 'transparent')
        ctx.globalAlpha = globalAlpha * n.alpha * 0.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      })

      // ── Connection lines between nearby nanites ────────────────────────────
      ctx.lineWidth = 0.4
      for (let i = 0; i < nanites.length; i++) {
        for (let j = i + 1; j < nanites.length; j++) {
          const a = nanites[i],
            b = nanites[j]
          const dx = a.x - b.x,
            dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 38) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = '#10b981'
            ctx.globalAlpha = globalAlpha * (1 - dist / 38) * 0.25
            ctx.stroke()
          }
        }
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(idleTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-9998"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}

// ─── Nanite proximity (card awakening) ───────────────────────────────────────

function NaniteProximity() {
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return

    const style = document.createElement('style')
    style.textContent = `
      [data-nanite] { position: relative; }
      [data-nanite]::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: radial-gradient(
          circle at calc(var(--nx, 0.5) * 100%) calc(var(--ny, 0.5) * 100%),
          rgba(16,185,129,0.16) 0%,
          rgba(16,185,129,0.05) 40%,
          transparent 70%
        );
        opacity: var(--np, 0);
        transition: opacity 0.12s linear;
      }
      @keyframes nanite-awaken {
        0%   { box-shadow: 0 0 0 0px  rgba(16,185,129,0.85), 0 0 0 0   transparent; }
        18%  { box-shadow: 0 0 0 3px  rgba(16,185,129,0.45), 0 0 24px 4px rgba(16,185,129,0.18); }
        55%  { box-shadow: 0 0 0 7px  rgba(16,185,129,0.15), 0 0 32px 6px rgba(16,185,129,0.07); }
        100% { box-shadow: 0 0 0 14px rgba(16,185,129,0),    0 0 0   0   transparent; }
      }
      [data-nanite][data-nanite-wake] {
        animation: nanite-awaken 0.9s ease-out forwards;
      }
    `
    document.head.appendChild(style)

    const mouse = { x: -500, y: -500 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)

    const cooldowns = new WeakMap<Element, number>()
    const THRESHOLD = 110

    let rafId: number
    const loop = () => {
      rafId = requestAnimationFrame(loop)
      const now = performance.now()
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nanite]'),
      )

      // Batch reads first to avoid layout thrashing
      const rects = elements.map((el) => el.getBoundingClientRect())

      // Batch writes
      elements.forEach((el, i) => {
        const r = rects[i]
        const dx = Math.max(r.left - mouse.x, 0, mouse.x - r.right)
        const dy = Math.max(r.top - mouse.y, 0, mouse.y - r.bottom)
        const dist = Math.sqrt(dx * dx + dy * dy)
        const np = Math.max(0, 1 - dist / THRESHOLD)
        const nx = Math.min(1, Math.max(0, (mouse.x - r.left) / r.width))
        const ny = Math.min(1, Math.max(0, (mouse.y - r.top) / r.height))

        el.style.setProperty('--np', np.toFixed(3))
        el.style.setProperty('--nx', nx.toFixed(3))
        el.style.setProperty('--ny', ny.toFixed(3))

        const cooldownEnd = cooldowns.get(el) ?? 0
        if (
          np > 0.28 &&
          now > cooldownEnd &&
          !el.hasAttribute('data-nanite-wake')
        ) {
          el.setAttribute('data-nanite-wake', '')
          cooldowns.set(el, now + 1600)
          setTimeout(() => el.removeAttribute('data-nanite-wake'), 900)
        }
      })
    }
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      style.remove()
    }
  }, [])

  return null
}

// ─── Hero headline nanite field ───────────────────────────────────────────────
interface HeroParticle {
  x: number
  y: number
  homeX: number
  homeY: number
  vx: number
  vy: number
  size: number
  baseAlpha: number
  nt: number
  ns: number
}

function HeroNaniteField({
  headlineRef,
}: {
  headlineRef: { current: HTMLHeadingElement | null }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: -9999, y: -9999 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)

    const COUNT = 90
    const particles: HeroParticle[] = []
    let ready = false

    const seedParticles = () => {
      const el = headlineRef.current
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (r.width === 0) return false
      particles.length = 0
      for (let i = 0; i < COUNT; i++) {
        const tight = Math.random() < 0.6
        const spread = tight ? 1.1 : 2.2
        const hx =
          r.left + r.width / 2 + (Math.random() - 0.5) * r.width * spread
        const hy =
          r.top + r.height / 2 + (Math.random() - 0.5) * r.height * spread * 1.8
        particles.push({
          x: hx + (Math.random() - 0.5) * 250,
          y: hy + (Math.random() - 0.5) * 80,
          homeX: hx,
          homeY: hy,
          vx: 0,
          vy: 0,
          size: 0.8 + Math.random() * 1.6,
          baseAlpha: 0.1 + Math.random() * 0.2,
          nt: Math.random() * 200,
          ns: 0.003 + Math.random() * 0.007,
        })
      }
      return true
    }

    // Re-seed on resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        ready = seedParticles()
      }, 150)
    }
    window.addEventListener('resize', onResize)

    // Layered pseudo-noise
    const noise = (t: number, s: number) =>
      Math.sin(t + s) * 0.5 +
      Math.sin(t * 1.9 + s * 1.1 + 2.3) * 0.3 +
      Math.sin(t * 0.6 + s * 0.5 + 4.1) * 0.2

    const REPEL_R = 160
    const REPEL_STR = 18
    const SPRING = 0.02
    const DAMP = 0.855

    let rafId: number
    let frame = 0

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      frame++
      if (!ready && frame > 3) ready = seedParticles()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!ready) return

      for (const p of particles) {
        p.nt += p.ns

        // Soft spring toward home + gentle noise drift
        p.vx += (p.homeX - p.x) * SPRING + noise(p.nt, 0.0) * 0.05
        p.vy += (p.homeY - p.y) * SPRING + noise(p.nt, 7.1) * 0.05

        // Cursor repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < REPEL_R && d > 0.1) {
          const f = Math.pow(1 - d / REPEL_R, 2) * REPEL_STR
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }

        p.vx *= DAMP
        p.vy *= DAMP
        p.x += p.vx
        p.y += p.vy

        // Visual: dull grey-green at rest → vivid emerald when displaced
        const disp = Math.hypot(p.x - p.homeX, p.y - p.homeY)
        const boost = Math.min(disp / 55, 0.55)
        const g = Math.round(110 + boost * 75) // 110 → 185
        const b = Math.round(70 + boost * 59) // 70  → 129
        ctx.globalAlpha = Math.min(0.9, p.baseAlpha + boost * 0.7)
        ctx.fillStyle = `rgb(10, ${g}, ${b})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    tick()

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9997, mixBlendMode: 'screen' }}
    />
  )
}

function HeroHeadline() {
  const h1Ref = useRef<HTMLHeadingElement>(null)
  return (
    <>
      <HeroNaniteField headlineRef={h1Ref} />
      <h1
        ref={h1Ref}
        className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 tracking-tight"
      >
        Retrospectives that
        <br />
        <span className="text-emerald-400">drive real change.</span>
      </h1>
    </>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function LandingNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        style={{
          background: 'rgba(5,13,20,0.80)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(16,185,129,0.10)',
        }}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center h-16">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="font-mono font-bold text-white text-sm tracking-tight hidden sm:block">
                Retro-Tool
              </span>
            </div>
            <nav className="ml-auto flex items-center gap-1">
              <Link
                to="/termsofservice"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Terms</span>
              </Link>
              <Link
                to="/privacystatement"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Privacy</span>
              </Link>
              <div className="w-px h-4 bg-gray-800 mx-1" />
              <Link
                to="/auth/sign-in"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-all duration-200 font-mono"
              >
                Sign In
              </Link>
              <Link to="/auth/sign-up">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-emerald-500 hover:bg-emerald-400 transition-all duration-200 font-mono cursor-pointer">
                  Sign Up
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-6">
      <span className="h-1 w-1 rounded-full bg-emerald-400" />
      <span className="text-xs font-mono font-medium text-emerald-400 tracking-widest uppercase">
        {children}
      </span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
function LandingPage() {
  return (
    <div
      className="min-h-screen text-white font-mono"
      style={{ background: '#050d14' }}
    >
      <NaniteCursor />
      <NaniteProximity />

      {/* ── Mesh background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 15% 15%, rgba(16,185,129,0.12) 0px, transparent 45%)',
            'radial-gradient(ellipse at 85% 5%,  rgba(6,182,212,0.08)  0px, transparent 40%)',
            'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.04) 0px, transparent 55%)',
            'radial-gradient(ellipse at 90% 80%, rgba(16,185,129,0.07) 0px, transparent 40%)',
            'radial-gradient(ellipse at 10% 85%, rgba(6,182,212,0.05)  0px, transparent 40%)',
            'radial-gradient(ellipse at 60% 95%, rgba(139,92,246,0.04) 0px, transparent 35%)',
          ].join(','),
        }}
      />

      {/* ── Mesh grid (matches sign-in) ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <LandingNav />

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono tracking-[0.2em] text-emerald-400 uppercase">
              Enterprise Retrospective Platform
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Headline */}
          <HeroHeadline />

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            Retro-Tool gives engineering teams a mission-critical platform to
            reflect, align, and act — with real-time collaboration, enterprise
            security, and analytics built in from day one.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button
              size="lg"
              asChild
              className="w-full sm:w-auto gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8
                transition-all duration-300 hover:scale-105 hover:-translate-y-1
                hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)]"
            >
              <Link to="/auth/sign-up">
                <Zap className="h-4 w-4" />
                Sign Up
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto gap-2 border-gray-700 text-gray-300 hover:border-emerald-500/50 hover:text-white hover:bg-emerald-500/5 font-medium px-8
                transition-all duration-300 hover:scale-105 hover:-translate-y-1"
            >
              <Link to="/auth/sign-in">
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Hero visual — mini command center */}
          <div className="relative max-w-4xl mx-auto">
            {/* Glow behind card */}
            <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-3xl scale-95" />
            <div
              className="relative rounded-2xl border border-[#1a2a20] overflow-hidden"
              style={{
                background: 'rgba(10,18,26,0.9)',
                boxShadow:
                  '0 0 0 1px rgba(16,185,129,0.08), 0 40px 80px -20px rgba(0,0,0,0.8)',
              }}
            >
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a2a20]">
                <div className="h-3 w-3 rounded-full bg-rose-500/70" />
                <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
                <div className="flex-1 mx-4 h-5 rounded bg-[#0d1a12]/60 flex items-center justify-center">
                  <span className="text-[10px] text-gray-600 tracking-widest">
                    retro-tool.com/retros/sprint-24
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">
                    4 online
                  </span>
                </div>
              </div>
              {/* Mock retro board */}
              <div className="grid grid-cols-3 gap-px bg-[#0d1a12]/40 p-px">
                {[
                  {
                    label: 'Went Well',
                    color: 'text-emerald-400',
                    border: 'border-emerald-500/20',
                    cards: [
                      'Shipped auth module ahead of schedule',
                      'Team communication was excellent',
                      'New CI pipeline saved 2hrs/day',
                    ],
                  },
                  {
                    label: 'Needs Work',
                    color: 'text-amber-400',
                    border: 'border-amber-500/20',
                    cards: [
                      'PR review turnaround too slow',
                      'Missing test coverage on edge cases',
                    ],
                  },
                  {
                    label: 'Action Items',
                    color: 'text-rose-400',
                    border: 'border-rose-500/20',
                    cards: [
                      'Set up weekly PR review slots',
                      'Add coverage gate to CI',
                      'Retro next sprint: Friday 2pm',
                    ],
                  },
                ].map((col) => (
                  <div
                    key={col.label}
                    className="p-4"
                    style={{ background: 'rgba(5,13,20,0.8)' }}
                  >
                    <div
                      className={`text-xs font-semibold ${col.color} mb-3 flex items-center gap-1.5`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${col.color.replace('text-', 'bg-')}`}
                      />
                      {col.label}
                    </div>
                    <div className="space-y-2">
                      {col.cards.map((c) => (
                        <div
                          key={c}
                          className={`text-xs text-gray-400 bg-[#0d1a12] border ${col.border} rounded-lg px-3 py-2 leading-snug`}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative py-10 border-y border-[#0f2018]"
        style={{ background: 'rgba(10,18,12,0.5)' }}
      >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center" data-nanite="">
                <p className="text-3xl font-bold text-emerald-400 mb-1">
                  {value}
                </p>
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CORE FEATURES
      ══════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <SectionLabel>Platform Capabilities</SectionLabel>
            <h2 className="text-4xl font-bold mb-4">
              Everything your team needs.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Purpose-built for engineering teams who take continuous
              improvement seriously.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CORE_FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  data-nanite=""
                  className={`group relative rounded-2xl border border-[#1a2633] p-6 transition-all duration-300 ${f.border} ${f.glow} cursor-default`}
                  style={{ background: 'rgba(8,16,24,0.8)' }}
                >
                  {/* Subtle top glow line */}
                  <div className="absolute top-0 left-6 right-6 h-px bg-linear-to-r from-transparent via-white/5 to-transparent" />

                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-xl border ${f.bg}`}>
                      <Icon className={`h-5 w-5 ${f.color}`} />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-full border tracking-widest ${f.badgeColor}`}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative py-24 px-6 border-y border-[#0f1f18]"
        style={{ background: 'rgba(8,18,14,0.6)' }}
      >
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <SectionLabel>Mission Sequence</SectionLabel>
            <h2 className="text-4xl font-bold mb-4">Three steps to launch.</h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              From zero to actionable insights in under 5 minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.step} className="relative">
                  {/* Connector line */}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-full h-px bg-linear-to-r from-emerald-500/30 to-transparent" />
                  )}
                  <div className="relative" data-nanite="">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <Icon className="h-5 w-5 text-emerald-400" />
                      </div>
                      <span className="text-3xl font-bold text-emerald-500/20 font-mono">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TEMPLATES
      ══════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <SectionLabel>Template Library</SectionLabel>
            <h2 className="text-4xl font-bold mb-4">
              Six formats. Infinite insight.
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Built-in templates for every team style. Or build your own from
              scratch.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.name}
                data-nanite=""
                className={`group relative rounded-xl border ${t.accent} p-5 transition-all duration-300 hover:-translate-y-1 cursor-default`}
                style={{ background: 'rgba(8,16,24,0.8)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${t.tag}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                    {t.category}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-emerald-400 transition-colors duration-200" />
                </div>
                <h3 className="font-semibold text-white mb-1">{t.name}</h3>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STORY ESTIMATES
      ══════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: mock story estimate UI */}
            <div className="relative">
              <div className="absolute -inset-4 bg-amber-500/5 blur-3xl rounded-3xl" />
              <div
                className="relative rounded-2xl border border-[#2a2010] overflow-hidden"
                style={{
                  background: 'rgba(10,16,8,0.92)',
                  boxShadow:
                    '0 0 0 1px rgba(245,158,11,0.08), 0 30px 60px -15px rgba(0,0,0,0.7)',
                }}
              >
                {/* Window bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2010]">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                  <div className="flex-1 mx-3 flex items-center justify-center gap-2">
                    <span className="text-[10px] text-gray-600 tracking-widest">
                      planning-poker · sprint-24
                    </span>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    LIVE
                  </span>
                </div>

                {/* Story card */}
                <div className="p-5 border-b border-[#1a1a10]">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
                    Current Story
                  </p>
                  <p className="text-sm font-semibold text-white">
                    Implement OAuth 2.0 login with Microsoft SSO
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    As a user, I want to sign in with my Microsoft account so I
                    don't need a separate password.
                  </p>
                </div>

                {/* Vote scale */}
                <div className="p-5 border-b border-[#1a1a10]">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
                    Your Vote · Fibonacci
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['1', '2', '3', '5', '8', '13', '21', '?'].map((v, i) => (
                      <div
                        key={v}
                        className={`h-10 w-10 rounded-lg border flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                          i === 4
                            ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                            : 'border-[#2a2010] text-gray-600 hover:border-amber-500/30 hover:text-amber-400'
                        }`}
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Votes panel — revealed */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                      Team Votes · Revealed
                    </p>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <ThumbsUp className="h-3 w-3" />
                      Consensus
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        name: 'alex.chen',
                        vote: '8',
                        color: 'text-amber-300',
                        bg: 'bg-amber-500/15 border-amber-500/30',
                      },
                      {
                        name: 'sara.k',
                        vote: '8',
                        color: 'text-amber-300',
                        bg: 'bg-amber-500/15 border-amber-500/30',
                      },
                      {
                        name: 'dev.ops',
                        vote: '13',
                        color: 'text-rose-300',
                        bg: 'bg-rose-500/10 border-rose-500/20',
                      },
                      {
                        name: 'you',
                        vote: '8',
                        color: 'text-amber-300',
                        bg: 'bg-amber-500/15 border-amber-500/30',
                      },
                    ].map(({ name, vote, color, bg }) => (
                      <div
                        key={name}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs text-gray-500 font-mono">
                          {name}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded border ${bg} ${color}`}
                        >
                          {vote}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Consensus bar */}
                  <div className="mt-4 h-1.5 rounded-full bg-[#1a2010] overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-linear-to-r from-amber-500 to-emerald-500" />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    3 of 4 voted{' '}
                    <span className="text-amber-400 font-semibold">8</span> —
                    strong consensus
                  </p>
                </div>
              </div>
            </div>

            {/* Right: copy + perks */}
            <div>
              <SectionLabel>Story Estimates</SectionLabel>
              <h2 className="text-4xl font-bold mb-5 leading-tight">
                Estimate stories
                <br />
                <span className="text-amber-400">as a team, live.</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Built-in story estimate sessions let your team vote on story
                points in real time. Votes stay hidden until everyone commits —
                then flip the reveal and discuss outliers instantly.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {ESTIMATION_PERKS.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    data-nanite=""
                    className="p-4 rounded-xl border border-[#2a2010] hover:border-amber-500/20 transition-colors duration-200"
                    style={{ background: 'rgba(8,16,8,0.8)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <Icon className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ENTERPRISE + EXTRA FEATURES
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative py-24 px-6 border-y border-[#0f1f18]"
        style={{ background: 'rgba(8,18,14,0.6)' }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: enterprise pitch */}
            <div>
              <SectionLabel>Enterprise Grade</SectionLabel>
              <h2 className="text-4xl font-bold mb-5 leading-tight">
                Built for organizations
                <br />
                <span className="text-emerald-400">at any scale.</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Retro-Tool is designed from the ground up for organizations
                running multiple teams across departments. Fine-grained access
                control, full audit capability, and Microsoft SSO make it
                enterprise-ready from day one.
              </p>

              <div className="space-y-3">
                {[
                  'Role-based access: 5 roles across org, team, and system scope',
                  'Microsoft OAuth for seamless enterprise sign-on',
                  'Multi-organization with owner/admin/member hierarchy',
                  'User approval workflow — no unauthorized access',
                  'Session management with secure cookie authentication',
                  'Email + push notifications for every critical event',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: extra feature grid */}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-5 font-medium">
                Also included
              </p>
              <div className="grid grid-cols-2 gap-3">
                {EXTRA_FEATURES.map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    data-nanite=""
                    className="relative flex items-start gap-3 p-4 rounded-xl border border-[#1a2633] hover:border-emerald-500/20 transition-colors duration-200"
                    style={{ background: 'rgba(8,16,24,0.8)' }}
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <p className="text-xs text-gray-400 leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="relative py-32 px-6 text-center overflow-hidden">
        {/* CTA glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-emerald-500/6 blur-[80px] rounded-full" />
        </div>

        <div className="relative container mx-auto max-w-3xl">
          <SectionLabel>Ready for Launch</SectionLabel>
          <h2 className="text-5xl font-bold mb-5 leading-tight">
            Your first retro is
            <br />
            <span className="text-emerald-400">30 seconds away.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join hundreds of engineering teams running faster, more effective
            retrospectives with Retro-Tool.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="w-full sm:w-auto gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-10 text-base
                transition-all duration-300 hover:scale-105 hover:-translate-y-1
                hover:shadow-[0_25px_50px_-10px_rgba(16,185,129,0.5)]"
            >
              <Link to="/auth/sign-up">
                <Zap className="h-5 w-5" />
                Sign Up
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="w-full sm:w-auto gap-2 text-gray-400 hover:text-white hover:bg-white/5 font-medium px-8"
            >
              <Link to="/auth/sign-in">
                Already have an account? Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#0f1f18] py-8 px-6">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <img
              src="/Retro-Tool-Logo.jpg"
              alt=""
              className="h-5 w-5 rounded object-cover opacity-60"
            />
            <span>
              © 2026 Retro-Tool. Built for teams who care about improvement.
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              to="/termsofservice"
              className="hover:text-emerald-400 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacystatement"
              className="hover:text-emerald-400 transition-colors"
            >
              Privacy Statement
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
