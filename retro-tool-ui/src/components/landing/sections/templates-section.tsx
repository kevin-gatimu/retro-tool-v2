import { ChevronRight } from 'lucide-react'
import { TEMPLATES } from '@/components/landing/landing-content'
import { SectionLabel } from '@/components/landing/section-label'

export function TemplatesSection() {
  return (
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
  )
}
