import { useEffect } from 'react'

export function NaniteProximity() {
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return

    const style = document.createElement('style')
    style.textContent = `
      [data-nanite] { position: relative; }
      [data-nanite]::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: radial-gradient(
          circle at calc(var(--nx, 0.5) * 100%) calc(var(--ny, 0.5) * 100%),
          rgba(16,185,129,0.16) 0%,
          rgba(16,185,129,0.05) 40%,
          transparent 70%
        );
        opacity: var(--np, 0);
        transition: opacity 0.12s linear;
      }
      @keyframes nanite-awaken {
        0%   { box-shadow: 0 0 0 0px  rgba(16,185,129,0.85), 0 0 0 0   transparent; }
        18%  { box-shadow: 0 0 0 3px  rgba(16,185,129,0.45), 0 0 24px 4px rgba(16,185,129,0.18); }
        55%  { box-shadow: 0 0 0 7px  rgba(16,185,129,0.15), 0 0 32px 6px rgba(16,185,129,0.07); }
        100% { box-shadow: 0 0 0 14px rgba(16,185,129,0),    0 0 0   0   transparent; }
      }
      [data-nanite][data-nanite-wake] {
        animation: nanite-awaken 0.9s ease-out forwards;
      }
    `
    document.head.appendChild(style)

    const mouse = { x: -500, y: -500 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)

    const cooldowns = new WeakMap<Element, number>()
    const THRESHOLD = 110

    let rafId: number
    const loop = () => {
      rafId = requestAnimationFrame(loop)
      const now = performance.now()
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nanite]'),
      )

      // Batch reads first to avoid layout thrashing
      const rects = elements.map((el) => el.getBoundingClientRect())

      // Batch writes
      elements.forEach((el, i) => {
        const r = rects[i]
        const dx = Math.max(r.left - mouse.x, 0, mouse.x - r.right)
        const dy = Math.max(r.top - mouse.y, 0, mouse.y - r.bottom)
        const dist = Math.sqrt(dx * dx + dy * dy)
        const np = Math.max(0, 1 - dist / THRESHOLD)
        const nx = Math.min(1, Math.max(0, (mouse.x - r.left) / r.width))
        const ny = Math.min(1, Math.max(0, (mouse.y - r.top) / r.height))

        el.style.setProperty('--np', np.toFixed(3))
        el.style.setProperty('--nx', nx.toFixed(3))
        el.style.setProperty('--ny', ny.toFixed(3))

        const cooldownEnd = cooldowns.get(el) ?? 0
        if (
          np > 0.28 &&
          now > cooldownEnd &&
          !el.hasAttribute('data-nanite-wake')
        ) {
          el.setAttribute('data-nanite-wake', '')
          cooldowns.set(el, now + 1600)
          setTimeout(() => el.removeAttribute('data-nanite-wake'), 900)
        }
      })
    }
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      style.remove()
    }
  }, [])

  return null
}
