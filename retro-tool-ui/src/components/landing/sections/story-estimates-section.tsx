import { ThumbsUp } from 'lucide-react'
import { ESTIMATION_PERKS } from '@/components/landing/landing-content'
import { SectionLabel } from '@/components/landing/section-label'

export function StoryEstimatesSection() {
  return (
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
                    story-estimate · sprint-24
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
                    <p className="text-sm font-semibold text-white">{title}</p>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
