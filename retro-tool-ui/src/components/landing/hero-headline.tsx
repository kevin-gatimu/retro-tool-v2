import { lazy, Suspense, useRef } from 'react'

const HeroNaniteField = lazy(() =>
  import('@/components/landing/nanite/hero-nanite-field').then((m) => ({
    default: m.HeroNaniteField,
  })),
)

export function HeroHeadline() {
  const h1Ref = useRef<HTMLHeadingElement>(null)
  return (
    <>
      <Suspense fallback={null}>
        <HeroNaniteField headlineRef={h1Ref} />
      </Suspense>
      <h1
        ref={h1Ref}
        className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 tracking-tight"
      >
        Retrospectives that
        <br />
        <span className="text-emerald-400">drive real change.</span>
      </h1>
    </>
  )
}
