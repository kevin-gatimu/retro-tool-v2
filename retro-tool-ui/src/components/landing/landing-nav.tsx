import { Link } from '@tanstack/react-router'
import { ChevronRight, FileText, Lock } from 'lucide-react'

export function LandingNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        style={{
          background: 'rgba(5,13,20,0.80)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(16,185,129,0.10)',
        }}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center h-16">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src="/Retro-Tool-Logo.jpg"
                alt="Retro-Tool"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="font-mono font-bold text-white text-sm tracking-tight hidden sm:block">
                Retro-Tool
              </span>
            </div>
            <nav className="ml-auto flex items-center gap-1">
              <Link
                to="/terms-of-service"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Terms</span>
              </Link>
              <Link
                to="/privacy-statement"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 font-mono"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Privacy</span>
              </Link>
              <div className="w-px h-4 bg-gray-800 mx-1" />
              <Link
                to="/auth/sign-in"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-all duration-200 font-mono"
              >
                Sign In
              </Link>
              <Link to="/auth/sign-up">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-emerald-500 hover:bg-emerald-400 transition-all duration-200 font-mono cursor-pointer">
                  Sign Up
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
