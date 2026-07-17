import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingNav } from '@/components/landing/landing-nav'
import { CoreFeaturesSection } from '@/components/landing/sections/core-features-section'
import { CtaSection } from '@/components/landing/sections/cta-section'
import { EnterpriseSection } from '@/components/landing/sections/enterprise-section'
import { HeroSection } from '@/components/landing/sections/hero-section'
import { HowItWorksSection } from '@/components/landing/sections/how-it-works-section'
import { StatsSection } from '@/components/landing/sections/stats-section'
import { StoryEstimatesSection } from '@/components/landing/sections/story-estimates-section'
import { TemplatesSection } from '@/components/landing/sections/templates-section'
import { LandingPageSkeleton } from './index.skeleton'

// Heavy decorative canvas overlays — lazy-loaded; the hero renders fine without them.
const NaniteCursor = lazy(() =>
  import('@/components/landing/nanite/nanite-cursor').then((m) => ({
    default: m.NaniteCursor,
  })),
)
const NaniteProximity = lazy(() =>
  import('@/components/landing/nanite/nanite-proximity').then((m) => ({
    default: m.NaniteProximity,
  })),
)

export const Route = createFileRoute('/')({
  pendingComponent: LandingPageSkeleton,
  component: LandingPage,
})

function LandingPage() {
  return (
    <div
      className="min-h-screen text-white font-mono"
      style={{ background: '#050d14' }}
    >
      <Suspense fallback={null}>
        <NaniteCursor />
        <NaniteProximity />
      </Suspense>

      {/* ── Mesh background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 15% 15%, rgba(16,185,129,0.12) 0px, transparent 45%)',
            'radial-gradient(ellipse at 85% 5%,  rgba(6,182,212,0.08)  0px, transparent 40%)',
            'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.04) 0px, transparent 55%)',
            'radial-gradient(ellipse at 90% 80%, rgba(16,185,129,0.07) 0px, transparent 40%)',
            'radial-gradient(ellipse at 10% 85%, rgba(6,182,212,0.05)  0px, transparent 40%)',
            'radial-gradient(ellipse at 60% 95%, rgba(139,92,246,0.04) 0px, transparent 35%)',
          ].join(','),
        }}
      />

      {/* ── Mesh grid (matches sign-in) ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <LandingNav />

      <HeroSection />
      <StatsSection />
      <CoreFeaturesSection />
      <HowItWorksSection />
      <TemplatesSection />
      <StoryEstimatesSection />
      <EnterpriseSection />
      <CtaSection />

      <LandingFooter />
    </div>
  )
}
