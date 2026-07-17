import type { ReactNode } from 'react'

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-6">
      <span className="h-1 w-1 rounded-full bg-emerald-400" />
      <span className="text-xs font-mono font-medium text-emerald-400 tracking-widest uppercase">
        {children}
      </span>
    </div>
  )
}
