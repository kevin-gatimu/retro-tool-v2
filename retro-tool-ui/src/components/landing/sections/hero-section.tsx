import { Link } from '@tanstack/react-router'
import { ArrowRight, Zap } from 'lucide-react'
import { HeroHeadline } from '@/components/landing/hero-headline'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
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
  )
}
