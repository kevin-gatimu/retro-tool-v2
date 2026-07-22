import { HOW_IT_WORKS } from '@/components/landing/landing-content'
import { SectionLabel } from '@/components/landing/section-label'

export function HowItWorksSection() {
  return (
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
  )
}
