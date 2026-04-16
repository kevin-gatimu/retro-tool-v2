import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  Users,
  Layers,
  ChevronRight,
  FileText,
  Lock,
} from 'lucide-react'
import { CardGridSkeleton } from '@/components/skeletons'

export const Route = createFileRoute('/')({
  pendingComponent: CardGridSkeleton,
  component: LandingPage,
})

function LandingNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="mx-auto"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(13,17,23,0.85) 40%, rgba(13,17,23,0.95) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(16,185,129,0.12)',
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="font-mono font-bold text-white text-sm tracking-tight hidden sm:block">
                Retro-Tool
              </span>
            </div>

            {/* Right half: nav links */}
            <nav className="ml-auto flex items-center gap-1">
              <a
                href="https://retro-tool.com"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-400
                  hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform duration-200" />
                retro-tool.com
              </a>

              <div className="w-px h-4 bg-gray-700 mx-1" />

              <Link
                to="/termsofservice"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-400
                  hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <FileText className="h-3.5 w-3.5" />
                Terms
              </Link>

              <Link
                to="/privacystatement"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-400
                  hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <Lock className="h-3.5 w-3.5" />
                Privacy
              </Link>

              <div className="w-px h-4 bg-gray-700 mx-1" />

              <Link to="/auth/sign-in">
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                    text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/70
                    hover:bg-emerald-500/10 transition-all duration-200 font-mono cursor-pointer"
                >
                  Sign In
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

function LandingPage() {
  const templates = [
    {
      name: 'Start, Stop, Continue',
      description: 'Classic format for identifying what to change',
      category: 'Classic',
      color: 'bg-emerald-600',
    },
    {
      name: '4Ls Retrospective',
      description: 'Liked, Learned, Lacked, Longed For',
      category: 'Classic',
      color: 'bg-emerald-600',
    },
    {
      name: 'Mad, Sad, Glad',
      description: 'Emotional check-in for team sentiment',
      category: 'Emotional',
      color: 'bg-rose-500',
    },
    {
      name: 'Sailboat',
      description: 'Visual metaphor for team progress',
      category: 'Visual',
      color: 'bg-cyan-500',
    },
    {
      name: 'DAKI',
      description: 'Drop, Add, Keep, Improve',
      category: 'Action',
      color: 'bg-amber-500',
    },
    {
      name: 'Custom Template',
      description: 'Build your own format',
      category: 'Custom',
      color: 'bg-violet-500',
    },
  ]

  const features = [
    {
      icon: Zap,
      title: 'Fast Setup',
      description: 'Start a retro in under 30 seconds',
      color: 'from-emerald-500 to-green-500',
    },
    {
      icon: Shield,
      title: 'Private & Secure',
      description: "Your team's data stays private",
      color: 'from-green-500 to-teal-500',
    },
    {
      icon: Clock,
      title: 'Time-Boxed',
      description: 'Built-in timer keeps things moving',
      color: 'from-teal-500 to-emerald-500',
    },
    {
      icon: Users,
      title: 'Team-Friendly',
      description: 'Works for teams of any size',
      color: 'from-emerald-600 to-green-500',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-mono">
      {/* Subtle Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.05),transparent_50%)]" />

      <LandingNav />

      <div className="relative">
        {/* Hero */}
        <div className="container mx-auto px-4 pt-28 pb-20">
          <div className="max-w-4xl mx-auto text-center mb-20">
            {/* Logo */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-16 w-16 rounded-xl object-cover"
              />
              <h1 className="text-6xl font-bold italic tracking-tight">
                Retro-Tool
              </h1>
            </div>

            {/* Enterprise Headline */}
            <h2 className="text-4xl font-bold mb-4">Retrospectives at Scale</h2>
            <h3 className="text-2xl font-semibold mb-6 text-emerald-400">
              For Modern Organizations
            </h3>

            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Retro-Tool provides the security, control, and flexibility that
              enterprise teams need to run effective retrospectives across
              departments and time zones.
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4 justify-center mb-20">
              <Button
                size="lg"
                asChild
                className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold
									transition-all duration-300 ease-out
									hover:scale-110 hover:-translate-y-1
									hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)]"
              >
                <Link to="/auth/sign-up">
                  <ChevronRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={3}
                  />
                  Sign Up
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="gap-2 border-emerald-500 hover:bg-emerald-500/10 text-emerald-400 font-semibold
									transition-all duration-300 ease-out
									hover:scale-110 hover:-translate-y-1
									hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)]
									hover:border-emerald-400 hover:text-emerald-300"
              >
                <Link to="/auth/sign-in">Sign In</Link>
              </Button>
            </div>
          </div>

          {/* Templates Grid */}
          <div
            className="max-w-6xl mx-auto mb-32"
            style={{ perspective: '1000px' }}
          >
            <div className="flex items-center justify-center gap-2 mb-8">
              <Layers className="h-6 w-6 text-emerald-500" />
              <h2 className="text-2xl font-bold">Templates</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template, idx) => (
                <div
                  key={idx}
                  className="group cursor-pointer"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div
                    className="bg-[#161b22] p-6 rounded-lg border border-gray-800 transition-all duration-300 ease-out
											hover:border-emerald-500/50 hover:shadow-[0_20px_50px_rgba(16,185,129,0.15)]
											group-hover:-translate-y-2"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: 'translateZ(0)',
                    }}
                  >
                    <div className="absolute inset-0 rounded-lg bg-linear-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 group-hover:to-transparent transition-all duration-300 pointer-events-none" />

                    <div
                      className="relative"
                      style={{ transform: 'translateZ(20px)' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${template.color} text-white shadow-lg
														transition-all duration-300 ease-out
														group-hover:-rotate-6 group-hover:scale-110 group-hover:-translate-y-1
														group-hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.4)]`}
                          style={{
                            transformStyle: 'preserve-3d',
                            transform: 'translateZ(30px)',
                          }}
                        >
                          {template.category}
                        </span>
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-emerald-300 transition-colors duration-300">
                        {template.name}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Choose Section */}
          <div className="max-w-5xl mx-auto mb-32">
            <div className="flex items-center justify-center gap-2 mb-12">
              <Zap className="h-6 w-6 text-emerald-500" />
              <h2 className="text-2xl font-bold">
                Why Teams Choose Retro-Tool
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div
                    className="relative bg-[#161b22] p-6 rounded-lg border border-gray-800 text-center
											transition-all duration-500 ease-out
											hover:border-emerald-500/50
											hover:scale-105 hover:-translate-y-3
											hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.3)]"
                  >
                    <div
                      className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, transparent 50%, rgba(16,185,129,0.1) 100%)',
                      }}
                    />

                    <div
                      className={`relative w-14 h-14 rounded-lg bg-linear-to-br ${feature.color} flex items-center justify-center mx-auto mb-4
												transition-all duration-500 ease-out
												group-hover:-translate-y-2 group-hover:scale-110 group-hover:rotate-6
												group-hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.4)]`}
                    >
                      <feature.icon className="h-7 w-7 text-white transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    <h3 className="font-semibold mb-2 transition-colors duration-300 group-hover:text-emerald-300">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-400 transition-colors duration-300 group-hover:text-gray-300">
                      {feature.description}
                    </p>

                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-linear-to-r from-emerald-500 to-teal-400
											group-hover:w-3/4 transition-all duration-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Section */}
          <div className="max-w-4xl mx-auto text-center mb-32">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full mb-8 border border-emerald-500/30">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                Enterprise Ready
              </span>
            </div>

            <h2 className="text-4xl font-bold mb-4">Retrospectives at Scale</h2>
            <h3 className="text-2xl font-semibold mb-6 text-emerald-400">
              For Modern Organizations
            </h3>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Retro-Tool provides the security, control, and flexibility that
              enterprise teams need to run effective retrospectives across
              departments and time zones.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Transform Your Retros?
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Pick a template and start running better retrospectives today
            </p>
            <Button
              size="lg"
              asChild
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
            >
              <Link to="/auth/sign-up">
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
                Try It Free
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 py-8 mt-20">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
            <p>© 2026 Retro-Tool. Open source and built for teams.</p>
            <div className="flex items-center gap-4 text-xs">
              <Link
                to="/termsofservice"
                className="hover:text-emerald-400 transition-colors duration-200"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacystatement"
                className="hover:text-emerald-400 transition-colors duration-200"
              >
                Privacy Statement
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
