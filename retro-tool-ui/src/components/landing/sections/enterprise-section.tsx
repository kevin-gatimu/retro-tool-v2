import { CheckCircle2 } from 'lucide-react'
import { EXTRA_FEATURES } from '@/components/landing/landing-content'
import { SectionLabel } from '@/components/landing/section-label'

export function EnterpriseSection() {
  return (
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
  )
}
