import { useEffect, useRef } from 'react'

interface HeroParticle {
  x: number
  y: number
  homeX: number
  homeY: number
  vx: number
  vy: number
  size: number
  baseAlpha: number
  nt: number
  ns: number
}

export function HeroNaniteField({
  headlineRef,
}: {
  headlineRef: { current: HTMLHeadingElement | null }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: -9999, y: -9999 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)

    const COUNT = 90
    const particles: HeroParticle[] = []
    let ready = false

    const seedParticles = () => {
      const el = headlineRef.current
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (r.width === 0) return false
      particles.length = 0
      for (let i = 0; i < COUNT; i++) {
        const tight = Math.random() < 0.6
        const spread = tight ? 1.1 : 2.2
        const hx =
          r.left + r.width / 2 + (Math.random() - 0.5) * r.width * spread
        const hy =
          r.top + r.height / 2 + (Math.random() - 0.5) * r.height * spread * 1.8
        particles.push({
          x: hx + (Math.random() - 0.5) * 250,
          y: hy + (Math.random() - 0.5) * 80,
          homeX: hx,
          homeY: hy,
          vx: 0,
          vy: 0,
          size: 0.8 + Math.random() * 1.6,
          baseAlpha: 0.1 + Math.random() * 0.2,
          nt: Math.random() * 200,
          ns: 0.003 + Math.random() * 0.007,
        })
      }
      return true
    }

    // Re-seed on resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        ready = seedParticles()
      }, 150)
    }
    window.addEventListener('resize', onResize)

    // Layered pseudo-noise
    const noise = (t: number, s: number) =>
      Math.sin(t + s) * 0.5 +
      Math.sin(t * 1.9 + s * 1.1 + 2.3) * 0.3 +
      Math.sin(t * 0.6 + s * 0.5 + 4.1) * 0.2

    const REPEL_R = 160
    const REPEL_STR = 18
    const SPRING = 0.02
    const DAMP = 0.855

    let rafId: number
    let frame = 0

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      frame++
      if (!ready && frame > 3) ready = seedParticles()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!ready) return

      for (const p of particles) {
        p.nt += p.ns

        // Soft spring toward home + gentle noise drift
        p.vx += (p.homeX - p.x) * SPRING + noise(p.nt, 0.0) * 0.05
        p.vy += (p.homeY - p.y) * SPRING + noise(p.nt, 7.1) * 0.05

        // Cursor repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < REPEL_R && d > 0.1) {
          const f = Math.pow(1 - d / REPEL_R, 2) * REPEL_STR
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }

        p.vx *= DAMP
        p.vy *= DAMP
        p.x += p.vx
        p.y += p.vy

        // Visual: dull grey-green at rest → vivid emerald when displaced
        const disp = Math.hypot(p.x - p.homeX, p.y - p.homeY)
        const boost = Math.min(disp / 55, 0.55)
        const g = Math.round(110 + boost * 75) // 110 → 185
        const b = Math.round(70 + boost * 59) // 70  → 129
        ctx.globalAlpha = Math.min(0.9, p.baseAlpha + boost * 0.7)
        ctx.fillStyle = `rgb(10, ${g}, ${b})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    tick()

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9997, mixBlendMode: 'screen' }}
    />
  )
}
