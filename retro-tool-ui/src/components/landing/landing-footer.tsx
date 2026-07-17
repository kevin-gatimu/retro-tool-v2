import { Link } from '@tanstack/react-router'

export function LandingFooter() {
  return (
    <footer className="border-t border-[#0f1f18] py-8 px-6">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <img
            src="/Retro-Tool-Logo.jpg"
            alt=""
            className="h-5 w-5 rounded object-cover opacity-60"
          />
          <span>
            © 2026 Retro-Tool. Built for teams who care about improvement.
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            to="/terms-of-service"
            className="hover:text-emerald-400 transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy-statement"
            className="hover:text-emerald-400 transition-colors"
          >
            Privacy Statement
          </Link>
        </div>
      </div>
    </footer>
  )
}
