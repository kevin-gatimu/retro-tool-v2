import { DetailPageSkeleton } from '@/components/skeletons'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { FileText, Lock } from 'lucide-react'

export const Route = createFileRoute('/auth')({
  pendingComponent: DetailPageSkeleton,
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col font-mono">
      {/* Ambient background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.05),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.03),transparent_50%)] pointer-events-none" />

      {/* Shared navbar */}
      <header
        className="relative z-50 shrink-0 border-b border-[rgba(16,185,129,0.12)]"
        style={{
          background: 'rgba(13,17,23,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <Link to="/" className="flex items-center gap-2 shrink-0 group">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-7 w-7 rounded-lg object-cover"
              />
              <span className="font-mono font-bold text-white text-sm tracking-tight hidden sm:block group-hover:text-emerald-400 transition-colors duration-200">
                Retro-Tool
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1">
              <Link
                to="/termsofservice"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Terms</span>
              </Link>
              <Link
                to="/privacystatement"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Privacy</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Each child page owns its own layout */}
      <div className="relative flex-1 z-10">
        <Outlet />
      </div>
    </div>
  )
}
