import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, forwardRef } from 'react'
import {
  FileText,
  Users,
  Shield,
  AlertCircle,
  CreditCard,
  XCircle,
  Scale,
  Mail,
  ArrowLeft,
  ChevronUp,
  Lock,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

import { LegalPageSkeleton } from '@/components/skeletons'

// ─── Nanite cursor ───────────────────────────────────────────────────────────
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
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (globalAlpha < 0.01) return
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
        n.trail.unshift({ x: n.x, y: n.y })
        if (n.trail.length > TRAIL_LEN) n.trail.pop()
        n.x += n.vx
        n.y += n.vy
      })
      nanites.forEach((n) => {
        for (let i = n.trail.length - 1; i >= 0; i--) {
          const pos = n.trail[i]
          const age = (i + 1) / TRAIL_LEN
          const fadeAlpha = globalAlpha * n.alpha * (1 - age) * (1 - age) * 0.55
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
      nanites.forEach((n) => {
        ctx.globalAlpha = globalAlpha * n.alpha
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4)
        glow.addColorStop(0, n.color + '66')
        glow.addColorStop(1, 'transparent')
        ctx.globalAlpha = globalAlpha * n.alpha * 0.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      })
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
      className="fixed inset-0 pointer-events-none z-[9998]"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}

export const Route = createFileRoute('/termsofservice')({
  pendingComponent: LegalPageSkeleton,
  component: TermsOfServicePage,
})

const SECTIONS = [
  { id: 'acceptance', label: 'Acceptance', icon: FileText },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'acceptable-use', label: 'Acceptable Use', icon: Shield },
  { id: 'intellectual-property', label: 'Intellectual Property', icon: Lock },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'termination', label: 'Termination', icon: XCircle },
  { id: 'disclaimers', label: 'Disclaimers', icon: AlertCircle },
  { id: 'governing-law', label: 'Governing Law', icon: Scale },
  { id: 'contact', label: 'Contact', icon: Mail },
]

function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState('acceptance')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id]
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: '-30% 0px -60% 0px' },
      )
      obs.observe(el)
      observers.push(obs)
    })

    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)

    return () => {
      observers.forEach((o) => o.disconnect())
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-mono">
      <NaniteCursor />
      {/* Ambient background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.04),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.03),transparent_50%)] pointer-events-none" />

      {/* Mini header */}
      <header
        className="sticky top-0 z-40 border-b border-[#21262d]"
        style={{
          background: 'rgba(13,17,23,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-emerald-400 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-[#21262d]" />
          <div className="flex items-center gap-2">
            <img
              src="/Retro-Tool-Logo.jpg"
              alt="Retro-Tool"
              className="h-6 w-6 rounded object-cover"
            />
            <span className="text-sm font-semibold text-white">Retro-Tool</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
            <Link
              to="/privacystatement"
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors duration-200"
            >
              <Lock className="h-3 w-3" />
              Privacy
            </Link>
            <div className="w-px h-4 bg-[#21262d]" />
            <Link
              to="/auth/sign-in"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400
                hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
            >
              Sign In
            </Link>
            <Link
              to="/auth/sign-up"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/70
                hover:bg-emerald-500/10 transition-all duration-200"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Page title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mb-6">
            <FileText className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Legal</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-gray-400 text-sm">
            Last updated:{' '}
            <span className="text-emerald-400">April 16, 2026</span>
          </p>
          <p className="text-gray-400 mt-4 max-w-2xl leading-relaxed text-sm">
            Please read these Terms of Service carefully before using
            Retro-Tool. By accessing or using our service, you agree to be bound
            by these terms.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-medium">
                On this page
              </p>
              <nav className="space-y-1">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all duration-200 cursor-pointer
                      ${
                        activeSection === id
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-[#161b22]'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="space-y-8 min-w-0">
            <Section
              id="acceptance"
              icon={FileText}
              title="1. Acceptance of Terms"
              ref={(el) => {
                sectionRefs.current['acceptance'] = el
              }}
            >
              <p>
                By creating an account or using Retro-Tool ("Service"), you
                confirm that you are at least 16 years of age and that you agree
                to these Terms of Service and our Privacy Statement. If you are
                using the Service on behalf of an organization, you represent
                that you have authority to bind that organization to these
                terms.
              </p>
              <p>
                We reserve the right to update these terms at any time.
                Continued use of the Service after changes constitutes
                acceptance of the revised terms. We will notify users of
                material changes via email or in-app notification.
              </p>
            </Section>

            <Section
              id="accounts"
              icon={Users}
              title="2. Accounts & Responsibilities"
              ref={(el) => {
                sectionRefs.current['accounts'] = el
              }}
            >
              <p>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activity that occurs under your
                account. You agree to:
              </p>
              <ul>
                <li>Provide accurate and complete registration information</li>
                <li>
                  Promptly notify us of any unauthorized use of your account
                </li>
                <li>Not share your account credentials with third parties</li>
                <li>
                  Not create accounts through automated means or under false
                  pretenses
                </li>
              </ul>
              <p>
                Organization admins are responsible for managing user access
                within their organization and ensuring that members comply with
                these terms.
              </p>
            </Section>

            <Section
              id="acceptable-use"
              icon={Shield}
              title="3. Acceptable Use"
              ref={(el) => {
                sectionRefs.current['acceptable-use'] = el
              }}
            >
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>
                  Upload, transmit, or distribute any content that is unlawful,
                  harmful, or infringing
                </li>
                <li>
                  Attempt to gain unauthorized access to our systems or other
                  users' accounts
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of the
                  Service
                </li>
                <li>
                  Use automated tools to scrape, mine, or extract data from the
                  Service
                </li>
                <li>
                  Impersonate any person or entity, or misrepresent your
                  affiliation
                </li>
                <li>
                  Transmit spam, unsolicited messages, or promotional content
                </li>
              </ul>
              <p>
                We reserve the right to investigate and take appropriate action
                against violations, including suspending or terminating
                accounts.
              </p>
            </Section>

            <Section
              id="intellectual-property"
              icon={Lock}
              title="4. Intellectual Property"
              ref={(el) => {
                sectionRefs.current['intellectual-property'] = el
              }}
            >
              <p>
                The Service and its original content, features, and
                functionality are owned by Retro-Tool and are protected by
                international copyright, trademark, and other intellectual
                property laws.
              </p>
              <p>
                You retain ownership of any content you submit, post, or display
                through the Service ("User Content"). By submitting User
                Content, you grant us a worldwide, non-exclusive, royalty-free
                license to use, reproduce, and display that content solely for
                the purpose of providing the Service.
              </p>
              <p>
                You represent that you have all rights necessary to grant this
                license and that your User Content does not infringe any
                third-party rights.
              </p>
            </Section>

            <Section
              id="subscriptions"
              icon={CreditCard}
              title="5. Subscriptions & Billing"
              ref={(el) => {
                sectionRefs.current['subscriptions'] = el
              }}
            >
              <p>
                Certain features of the Service may be offered on a subscription
                basis. By subscribing, you authorize us to charge your payment
                method on a recurring basis until you cancel.
              </p>
              <ul>
                <li>
                  <strong className="text-white">Cancellation:</strong> You may
                  cancel at any time. Access continues until the end of the
                  current billing period.
                </li>
                <li>
                  <strong className="text-white">Refunds:</strong> Subscription
                  fees are generally non-refundable except where required by
                  law.
                </li>
                <li>
                  <strong className="text-white">Price changes:</strong> We will
                  provide at least 30 days' notice before changing subscription
                  prices.
                </li>
                <li>
                  <strong className="text-white">Free tier:</strong> We offer a
                  free tier with limited features that may be modified or
                  discontinued at our discretion.
                </li>
              </ul>
            </Section>

            <Section
              id="termination"
              icon={XCircle}
              title="6. Termination"
              ref={(el) => {
                sectionRefs.current['termination'] = el
              }}
            >
              <p>
                We may suspend or terminate your access to the Service
                immediately, without prior notice, if you breach these Terms or
                if we determine that continued access poses a risk to the
                Service, other users, or third parties.
              </p>
              <p>
                You may terminate your account at any time by contacting us or
                using the account deletion feature in Settings. Upon
                termination:
              </p>
              <ul>
                <li>Your right to use the Service ceases immediately</li>
                <li>
                  We may delete your data in accordance with our data retention
                  policy
                </li>
                <li>
                  Provisions that by their nature should survive termination
                  will remain in effect
                </li>
              </ul>
            </Section>

            <Section
              id="disclaimers"
              icon={AlertCircle}
              title="7. Disclaimers & Limitation of Liability"
              ref={(el) => {
                sectionRefs.current['disclaimers'] = el
              }}
            >
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT
                NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, RETRO-TOOL SHALL NOT BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL,
                ARISING FROM YOUR USE OF THE SERVICE.
              </p>
              <p>
                OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM USE OF
                THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE
                TWELVE MONTHS PRECEDING THE CLAIM.
              </p>
            </Section>

            <Section
              id="governing-law"
              icon={Scale}
              title="8. Governing Law"
              ref={(el) => {
                sectionRefs.current['governing-law'] = el
              }}
            >
              <p>
                These Terms shall be governed by and construed in accordance
                with the laws of the jurisdiction in which Retro-Tool is
                registered, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising under these Terms shall first be attempted
                to be resolved through good-faith negotiation. If negotiation
                fails, disputes shall be submitted to binding arbitration in
                accordance with applicable arbitration rules.
              </p>
              <p>
                Nothing in this section prevents either party from seeking
                injunctive or other equitable relief in any court of competent
                jurisdiction to prevent actual or threatened infringement.
              </p>
            </Section>

            <Section
              id="contact"
              icon={Mail}
              title="9. Contact Us"
              ref={(el) => {
                sectionRefs.current['contact'] = el
              }}
            >
              <p>If you have questions about these Terms, please contact us:</p>
              <div className="mt-4 p-4 bg-[#0d1117] rounded-lg border border-[#21262d]">
                <p className="text-emerald-400 font-medium mb-1">Retro-Tool</p>
                <p className="text-gray-400 text-sm">
                  Email:{' '}
                  <a
                    href="mailto:legal@retro-tool.com"
                    className="text-emerald-400 hover:underline"
                  >
                    legal@retro-tool.com
                  </a>
                </p>
                <p className="text-gray-400 text-sm">
                  General:{' '}
                  <a
                    href="mailto:info@retro-tool.com"
                    className="text-emerald-400 hover:underline"
                  >
                    info@retro-tool.com
                  </a>
                </p>
                <p className="text-gray-400 text-sm">
                  Website:{' '}
                  <a
                    href="https://retro-tool.com"
                    className="text-emerald-400 hover:underline"
                  >
                    https://retro-tool.com
                  </a>
                </p>
              </div>
            </Section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#21262d] mt-20 py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© 2026 Retro-Tool. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-emerald-400 transition-colors">
              Home
            </Link>
            <Link
              to="/termsofservice"
              className="hover:text-emerald-400 transition-colors text-emerald-400"
            >
              Terms
            </Link>
            <Link
              to="/privacystatement"
              className="hover:text-emerald-400 transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-emerald-500 text-black shadow-lg
            hover:bg-emerald-400 transition-all duration-200 hover:scale-110 cursor-pointer
            shadow-[0_0_20px_rgba(16,185,129,0.4)]"
        >
          <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

const Section = forwardRef<
  HTMLElement,
  { id: string; icon: LucideIcon; title: string; children: React.ReactNode }
>(({ id, icon: Icon, title, children }, ref) => (
  <section
    id={id}
    ref={ref}
    className="scroll-mt-24 bg-[#161b22] rounded-xl border border-[#21262d] overflow-hidden
      hover:border-emerald-500/20 transition-colors duration-300"
  >
    <div className="flex items-center gap-3 px-6 py-4 border-b border-[#21262d] bg-[#0d1117]/50">
      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Icon className="h-4 w-4 text-emerald-400" />
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <div className="px-6 py-5 text-sm text-gray-400 leading-relaxed space-y-3 [&_ul]:space-y-2 [&_ul]:list-none [&_ul_li]:flex [&_ul_li]:gap-2 [&_ul_li]:before:content-['▸'] [&_ul_li]:before:text-emerald-500 [&_ul_li]:before:shrink-0 [&_ul_li]:before:mt-0.5">
      {children}
    </div>
  </section>
))
Section.displayName = 'Section'
