import { Link } from '@tanstack/react-router'
import { ArrowRight, Zap } from 'lucide-react'
import { SectionLabel } from '@/components/landing/section-label'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section className="relative py-32 px-6 text-center overflow-hidden">
      {/* CTA glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-emerald-500/6 blur-[80px] rounded-full" />
      </div>

      <div className="relative container mx-auto max-w-3xl">
        <SectionLabel>Ready for Launch</SectionLabel>
        <h2 className="text-5xl font-bold mb-5 leading-tight">
          Your first retro is
          <br />
          <span className="text-emerald-400">30 seconds away.</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Join hundreds of engineering teams running faster, more effective
          retrospectives with Retro-Tool.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            asChild
            className="w-full sm:w-auto gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-10 text-base
              transition-all duration-300 hover:scale-105 hover:-translate-y-1
              hover:shadow-[0_25px_50px_-10px_rgba(16,185,129,0.5)]"
          >
            <Link to="/auth/sign-up">
              <Zap className="h-5 w-5" />
              Sign Up
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            asChild
            className="w-full sm:w-auto gap-2 text-gray-400 hover:text-white hover:bg-white/5 font-medium px-8"
          >
            <Link to="/auth/sign-in">
              Already have an account? Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
