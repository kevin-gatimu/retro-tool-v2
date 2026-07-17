import { CORE_FEATURES } from '@/components/landing/landing-content'
import { SectionLabel } from '@/components/landing/section-label'

export function CoreFeaturesSection() {
  return (
    <section className="relative py-28 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <SectionLabel>Platform Capabilities</SectionLabel>
          <h2 className="text-4xl font-bold mb-4">
            Everything your team needs.
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Purpose-built for engineering teams who take continuous improvement
            seriously.
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
  )
}
