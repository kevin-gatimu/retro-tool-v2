import { useEffect, useRef } from 'react'
import { TRAIL_LEN } from '@/components/landing/landing-content'

interface Nanite {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  orbitRadius: number
  orbitAngle: number
  orbitSpeed: number
  lag: number
  alpha: number
  color: string
  pulseOffset: number
  trail: { x: number; y: number }[]
}

export function NaniteCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return

    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { x: -500, y: -500, active: false }
    let idleTimer: ReturnType<typeof setTimeout>

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        mouse.active = false
      }, 2000)
    }
    window.addEventListener('mousemove', onMove)

    const COUNT = 28
    const COLORS = [
      '#10b981',
      '#10b981',
      '#10b981',
      '#06b6d4',
      '#34d399',
      '#06b6d4',
    ]

    const nanites: Nanite[] = Array.from({ length: COUNT }, (_, i) => ({
      x: -500,
      y: -500,
      vx: 0,
      vy: 0,
      size: 1.2 + Math.random() * 2,
      orbitRadius: i < 10 ? 6 + Math.random() * 14 : 18 + Math.random() * 32,
      orbitAngle: (i / COUNT) * Math.PI * 2 + Math.random() * 0.5,
      orbitSpeed:
        (0.008 + Math.random() * 0.018) * (Math.random() < 0.5 ? 1 : -1),
      lag: i < 10 ? 0.14 + Math.random() * 0.12 : 0.06 + Math.random() * 0.08,
      alpha: 0.5 + Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulseOffset: Math.random() * Math.PI * 2,
      trail: [],
    }))

    let frame = 0
    let globalAlpha = 0
    let rafId: number

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      frame++

      const targetAlpha = mouse.active ? 1 : 0
      globalAlpha += (targetAlpha - globalAlpha) * 0.04

      // Full clear every frame — trails are drawn from position history
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (globalAlpha < 0.01) return

      // ── Update physics & record trail ──────────────────────────────────────
      nanites.forEach((n) => {
        n.orbitAngle += n.orbitSpeed
        const breathe = 1 + 0.18 * Math.sin(frame * 0.025 + n.pulseOffset)
        const r = n.orbitRadius * breathe
        const tx = mouse.x + Math.cos(n.orbitAngle) * r
        const ty = mouse.y + Math.sin(n.orbitAngle) * r

        n.vx += (tx - n.x) * n.lag
        n.vy += (ty - n.y) * n.lag
        n.vx *= 0.72
        n.vy *= 0.72

        // Snapshot before moving — trail holds where particle was
        n.trail.unshift({ x: n.x, y: n.y })
        if (n.trail.length > TRAIL_LEN) n.trail.pop()

        n.x += n.vx
        n.y += n.vy
      })

      // ── Draw smoky trails (oldest → newest so newer sits on top) ──────────
      nanites.forEach((n) => {
        for (let i = n.trail.length - 1; i >= 0; i--) {
          const pos = n.trail[i]
          // age 1 = oldest, 0 = newest
          const age = (i + 1) / TRAIL_LEN
          // Quadratic fade — fast at first, lingers then vanishes
          const fadeAlpha = globalAlpha * n.alpha * (1 - age) * (1 - age) * 0.55
          // Spread outward as it ages — the "smoke diffuse" look
          const spread = n.size * (1 + age * 3.5)

          const grad = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            spread,
          )
          grad.addColorStop(0, n.color + 'bb')
          grad.addColorStop(0.4, n.color + '44')
          grad.addColorStop(1, 'transparent')

          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, spread, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      })

      // ── Draw live nanite cores ─────────────────────────────────────────────
      nanites.forEach((n) => {
        // Core dot
        ctx.globalAlpha = globalAlpha * n.alpha
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()

        // Glow halo
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4)
        glow.addColorStop(0, n.color + '66')
        glow.addColorStop(1, 'transparent')
        ctx.globalAlpha = globalAlpha * n.alpha * 0.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      })

      // ── Connection lines between nearby nanites ────────────────────────────
      ctx.lineWidth = 0.4
      for (let i = 0; i < nanites.length; i++) {
        for (let j = i + 1; j < nanites.length; j++) {
          const a = nanites[i],
            b = nanites[j]
          const dx = a.x - b.x,
            dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 38) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = '#10b981'
            ctx.globalAlpha = globalAlpha * (1 - dist / 38) * 0.25
            ctx.stroke()
          }
        }
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(idleTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-9998"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
