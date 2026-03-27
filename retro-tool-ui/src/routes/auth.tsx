import { DetailPageSkeleton } from '@/components/skeletons'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/auth')({
  pendingComponent: DetailPageSkeleton,
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex font-mono">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.05),transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.03),transparent_50%)]" />

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
        <div>
          <Link to="/" className="flex items-center gap-3 text-white group">
            <span className="text-2xl font-bold group-hover:text-emerald-400 transition-colors">
              Retro-Tool
            </span>
          </Link>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Team Retrospectives
            <br />
            <span className="text-emerald-400">Made Simple</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Reflect, improve, and grow together. Run effective retrospectives
            that help your team learn and adapt.
          </p>
        </div>

        <div className="text-gray-600 text-sm">
          © {new Date().getFullYear()} Retro-Tool. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Link to="/" className="flex items-center gap-3 text-white">
              <span className="text-xl font-bold">Retro-Tool</span>
            </Link>
          </div>

          {/* Form Container - Dark themed */}
          <div
            className="bg-[#161b22] rounded-2xl border border-gray-800 p-8
              shadow-[0_25px_60px_-15px_rgba(16,185,129,0.2)]
              transition-all duration-500 hover:shadow-[0_30px_70px_-15px_rgba(16,185,129,0.3)]
              hover:border-emerald-500/30 relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

            <Outlet />

            {/* Bottom highlight */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
          </div>
        </div>
      </div>
    </div>
  )
}
