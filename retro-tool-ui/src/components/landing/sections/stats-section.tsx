import { STATS } from '@/components/landing/landing-content'

export function StatsSection() {
  return (
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
  )
}
