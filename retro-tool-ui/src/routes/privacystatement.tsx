import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Lock,
  Database,
  Eye,
  Server,
  Cookie,
  Globe,
  UserCheck,
  Mail,
  ArrowLeft,
  ChevronUp,
  FileText,
  Shield,
} from 'lucide-react'

export const Route = createFileRoute('/privacystatement')({
  component: PrivacyStatementPage,
})

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Lock },
  { id: 'data-collected', label: 'Data We Collect', icon: Database },
  { id: 'how-used', label: 'How We Use Data', icon: Eye },
  { id: 'storage', label: 'Storage & Security', icon: Server },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
  { id: 'third-parties', label: 'Third Parties', icon: Globe },
  { id: 'your-rights', label: 'Your Rights', icon: UserCheck },
  { id: 'contact', label: 'Contact', icon: Mail },
]

const DATA_TABLE = [
  {
    category: 'Account',
    examples: 'Name, email, password hash',
    purpose: 'Authentication & account management',
    retention: 'Until deletion',
  },
  {
    category: 'Usage',
    examples: 'Pages visited, features used, session duration',
    purpose: 'Product improvement & analytics',
    retention: '90 days',
  },
  {
    category: 'Retrospective Content',
    examples: 'Cards, action items, votes',
    purpose: 'Core service functionality',
    retention: 'Until deleted by user',
  },
  {
    category: 'Communications',
    examples: 'Support emails, feedback',
    purpose: 'Customer support',
    retention: '3 years',
  },
  {
    category: 'Technical',
    examples: 'IP address, browser type, device info',
    purpose: 'Security & fraud prevention',
    retention: '30 days',
  },
  {
    category: 'Payment',
    examples: 'Billing address, last 4 digits',
    purpose: 'Subscription management',
    retention: '7 years (legal)',
  },
]

const RIGHTS = [
  {
    icon: Eye,
    title: 'Access',
    desc: 'Request a copy of your personal data at any time.',
  },
  {
    icon: Shield,
    title: 'Rectify',
    desc: 'Correct inaccurate or incomplete data we hold.',
  },
  {
    icon: UserCheck,
    title: 'Erase',
    desc: 'Request deletion of your data ("right to be forgotten").',
  },
  {
    icon: Lock,
    title: 'Restrict',
    desc: 'Limit how we process your data in certain circumstances.',
  },
  {
    icon: Database,
    title: 'Portability',
    desc: 'Receive your data in a structured, machine-readable format.',
  },
  {
    icon: Globe,
    title: 'Object',
    desc: 'Opt out of processing for direct marketing or profiling.',
  },
]

function PrivacyStatementPage() {
  const [activeSection, setActiveSection] = useState('overview')
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
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.04),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.03),transparent_50%)] pointer-events-none" />

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
              to="/termsofservice"
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors duration-200"
            >
              <FileText className="h-3 w-3" />
              Terms
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mb-6">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Legal</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Privacy Statement</h1>
          <p className="text-gray-400 text-sm">
            Last updated:{' '}
            <span className="text-emerald-400">April 16, 2026</span>
          </p>
          <p className="text-gray-400 mt-4 max-w-2xl leading-relaxed text-sm">
            Your privacy matters. This statement explains what data we collect,
            why we collect it, and how you can control it. We are committed to
            transparency and GDPR compliance.
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
              id="overview"
              icon={Lock}
              title="1. Overview"
              ref={(el) => {
                sectionRefs.current['overview'] = el
              }}
            >
              <p>
                Retro-Tool ("we", "us", "our") operates the platform available
                at retro-tool.com. This Privacy Statement describes how we
                collect, use, and protect your personal information when you use
                our Service.
              </p>
              <p>
                We act as the data controller for personal data collected
                through the Service. We process data in accordance with the
                General Data Protection Regulation (GDPR), UK GDPR, and other
                applicable privacy laws.
              </p>
              <p>
                By using our Service, you consent to the practices described in
                this statement. If you do not agree, please discontinue use of
                the Service.
              </p>
            </Section>

            <Section
              id="data-collected"
              icon={Database}
              title="2. Data We Collect"
              ref={(el) => {
                sectionRefs.current['data-collected'] = el
              }}
            >
              <p>
                We collect only the data necessary to provide and improve the
                Service. The table below summarizes what we collect and why:
              </p>
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#21262d]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#0d1117] border-b border-[#21262d]">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Category
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Examples
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Purpose
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium whitespace-nowrap">
                        Retention
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DATA_TABLE.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-[#21262d] transition-colors duration-150 hover:bg-emerald-500/5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#0d1117]/30'}`}
                      >
                        <td className="px-4 py-3 text-emerald-400 font-medium whitespace-nowrap">
                          {row.category}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {row.examples}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {row.purpose}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {row.retention}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              id="how-used"
              icon={Eye}
              title="3. How We Use Your Data"
              ref={(el) => {
                sectionRefs.current['how-used'] = el
              }}
            >
              <p>We use your personal data to:</p>
              <ul>
                <li>Provide, operate, and maintain the Service</li>
                <li>Authenticate your identity and manage your account</li>
                <li>Process payments and manage subscriptions</li>
                <li>
                  Send transactional emails (invites, reminders, digest
                  notifications)
                </li>
                <li>Monitor and improve Service performance and security</li>
                <li>Respond to support requests and legal inquiries</li>
                <li>Comply with applicable laws and regulations</li>
              </ul>
              <p>
                We do <strong className="text-white">not</strong> sell your
                personal data to third parties. We do not use your retrospective
                content for training AI models.
              </p>
            </Section>

            <Section
              id="storage"
              icon={Server}
              title="4. Storage & Security"
              ref={(el) => {
                sectionRefs.current['storage'] = el
              }}
            >
              <p>
                Your data is stored on servers located within the European
                Economic Area (EEA) or in jurisdictions with adequate data
                protection frameworks as recognized by the European Commission.
              </p>
              <p>
                We implement appropriate technical and organizational measures
                to protect your data, including:
              </p>
              <ul>
                <li>Encryption in transit (TLS 1.2+) and at rest (AES-256)</li>
                <li>Hashed and salted password storage</li>
                <li>
                  Role-based access controls limiting employee access to
                  personal data
                </li>
                <li>Regular security audits and penetration testing</li>
                <li>
                  Incident response procedures with breach notification within
                  72 hours
                </li>
              </ul>
            </Section>

            <Section
              id="cookies"
              icon={Cookie}
              title="5. Cookies & Tracking"
              ref={(el) => {
                sectionRefs.current['cookies'] = el
              }}
            >
              <p>
                We use cookies and similar technologies to operate the Service.
                Our cookies fall into these categories:
              </p>
              <ul>
                <li>
                  <strong className="text-white">Essential:</strong> Session
                  authentication cookies required for the Service to function.
                  Cannot be disabled.
                </li>
                <li>
                  <strong className="text-white">Functional:</strong> Cookies
                  that remember your preferences (e.g., theme, language). Can be
                  disabled.
                </li>
                <li>
                  <strong className="text-white">Analytics:</strong> Anonymous
                  usage data to understand how the Service is used. Can be opted
                  out.
                </li>
              </ul>
              <p>
                We do not use advertising or cross-site tracking cookies. You
                can manage cookie preferences in your browser settings.
              </p>
            </Section>

            <Section
              id="third-parties"
              icon={Globe}
              title="6. Third-Party Services"
              ref={(el) => {
                sectionRefs.current['third-parties'] = el
              }}
            >
              <p>
                We share data with trusted third-party service providers only as
                necessary to deliver the Service:
              </p>
              <ul>
                <li>
                  <strong className="text-white">Resend:</strong> Email delivery
                  for notifications and digests
                </li>
                <li>
                  <strong className="text-white">Payment processor:</strong>{' '}
                  Billing and subscription management (we never store full card
                  numbers)
                </li>
                <li>
                  <strong className="text-white">Microsoft Azure:</strong>{' '}
                  Infrastructure and authentication (Microsoft OAuth)
                </li>
                <li>
                  <strong className="text-white">Error monitoring:</strong>{' '}
                  Anonymized crash reports to maintain service stability
                </li>
              </ul>
              <p>
                All third-party providers are contractually required to protect
                your data and comply with applicable privacy laws. We do not
                allow them to use your data for their own purposes.
              </p>
            </Section>

            <Section
              id="your-rights"
              icon={UserCheck}
              title="7. Your Rights"
              ref={(el) => {
                sectionRefs.current['your-rights'] = el
              }}
            >
              <p>
                Under GDPR and other applicable laws, you have the following
                rights regarding your personal data:
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {RIGHTS.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex gap-3 p-3 rounded-lg bg-[#0d1117] border border-[#21262d] hover:border-emerald-500/20 transition-colors duration-200"
                  >
                    <div className="p-1.5 rounded-md bg-emerald-500/10 shrink-0 self-start">
                      <Icon className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-semibold mb-0.5">
                        {title}
                      </p>
                      <p className="text-gray-500 text-xs leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                To exercise any of these rights, contact us at{' '}
                <a
                  href="mailto:privacy@retro-tool.com"
                  className="text-emerald-400 hover:underline"
                >
                  privacy@retro-tool.com
                </a>
                . We will respond within 30 days. You also have the right to
                lodge a complaint with your local data protection authority.
              </p>
            </Section>

            <Section
              id="contact"
              icon={Mail}
              title="8. Contact & Data Controller"
              ref={(el) => {
                sectionRefs.current['contact'] = el
              }}
            >
              <p>
                For privacy-related questions, data subject requests, or to
                report a concern:
              </p>
              <div className="mt-4 p-4 bg-[#0d1117] rounded-lg border border-[#21262d]">
                <p className="text-emerald-400 font-medium mb-1">
                  Retro-Tool — Data Controller
                </p>
                <p className="text-gray-400 text-sm">
                  Privacy email:{' '}
                  <a
                    href="mailto:privacy@retro-tool.com"
                    className="text-emerald-400 hover:underline"
                  >
                    privacy@retro-tool.com
                  </a>
                </p>
                <p className="text-gray-400 text-sm">
                  General:{' '}
                  <a
                    href="mailto:hello@retro-tool.com"
                    className="text-emerald-400 hover:underline"
                  >
                    hello@retro-tool.com
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
              className="hover:text-emerald-400 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/privacystatement"
              className="hover:text-emerald-400 transition-colors text-emerald-400"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>

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
