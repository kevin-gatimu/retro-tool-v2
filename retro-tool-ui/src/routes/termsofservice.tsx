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

export const Route = createFileRoute('/termsofservice')({
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
