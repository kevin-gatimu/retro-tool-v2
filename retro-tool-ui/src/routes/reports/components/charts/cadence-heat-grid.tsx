import { useMemo } from 'react'
import type { CadenceCell } from '../../types'

interface CadenceHeatGridProps {
  cells: CadenceCell[]
}

/**
 * Retro cadence heat grid: teams × buckets, cell opacity scaled by retro
 * count. Pure CSS grid — no chart library needed for a heatmap this small.
 */
export function CadenceHeatGrid({ cells }: CadenceHeatGridProps) {
  const { teams, buckets, byKey, max } = useMemo(() => {
    const teamMap = new Map<string, string>()
    const bucketSet = new Set<string>()
    const cellMap = new Map<string, number>()
    let maxRetros = 1
    for (const cell of cells) {
      teamMap.set(cell.teamId, cell.teamName)
      bucketSet.add(cell.bucket)
      cellMap.set(`${cell.teamId}|${cell.bucket}`, cell.retros)
      if (cell.retros > maxRetros) maxRetros = cell.retros
    }
    return {
      teams: [...teamMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      buckets: [...bucketSet].sort(),
      byKey: cellMap,
      max: maxRetros,
    }
  }, [cells])

  if (teams.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No completed retros in this range.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 text-xs"
        style={{
          gridTemplateColumns: `minmax(120px, auto) repeat(${buckets.length}, minmax(28px, 1fr))`,
        }}
      >
        <span />
        {buckets.map((bucket) => (
          <span
            key={bucket}
            className="rotate-0 truncate text-center text-muted-foreground"
            title={bucket}
          >
            {bucket.slice(5)}
          </span>
        ))}
        {teams.map(([teamId, teamName]) => (
          <CadenceRow
            key={teamId}
            teamId={teamId}
            teamName={teamName}
            buckets={buckets}
            byKey={byKey}
            max={max}
          />
        ))}
      </div>
    </div>
  )
}

function CadenceRow({
  teamId,
  teamName,
  buckets,
  byKey,
  max,
}: {
  teamId: string
  teamName: string
  buckets: string[]
  byKey: Map<string, number>
  max: number
}) {
  return (
    <>
      <span className="truncate pr-2" title={teamName}>
        {teamName}
      </span>
      {buckets.map((bucket) => {
        const retros = byKey.get(`${teamId}|${bucket}`) ?? 0
        return (
          <div
            key={bucket}
            title={`${teamName} — ${bucket}: ${retros} retro${retros === 1 ? '' : 's'}`}
            className="h-6 rounded-sm border border-border"
            style={{
              backgroundColor: retros > 0 ? 'var(--chart-1)' : 'var(--muted)',
              opacity: retros > 0 ? 0.35 + 0.65 * (retros / max) : 0.5,
            }}
          />
        )
      })}
    </>
  )
}

export default CadenceHeatGrid
