import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrgLogoProps {
  logo?: string | null
  name: string
  /**
   * Size tier:
   *  - 20 → list page  (square h-20 w-20 / fallback h-20 w-20)
   *  - 32 → detail page (fallback h-24 w-24)
   */
  height?: 20 | 32
  /**
   * When true the container shrinks to tightly hug the image with no dead
   * whitespace (ideal for wide/landscape logos on the detail page).
   * When false (default) a fixed square is used.
   */
  tight?: boolean
}

export function OrgLogo({
  logo,
  name,
  height = 20,
  tight = false,
}: OrgLogoProps) {
  const fixedBox = height === 32 ? 'h-32 w-32' : 'h-20 w-20'
  const fallbackBox = height === 32 ? 'h-24 w-24' : 'h-20 w-20'
  const fallbackIcon = height === 32 ? 'h-12 w-12' : 'h-10 w-10'
  const maxH = height === 32 ? 'max-h-24' : 'max-h-16'
  const maxW = height === 32 ? 'max-w-56' : 'max-w-36'

  if (logo) {
    if (tight) {
      return (
        <div className="inline-flex items-center justify-center rounded-xl bg-white p-2">
          <img
            src={logo}
            alt={name}
            className={cn('object-contain', maxH, maxW)}
          />
        </div>
      )
    }

    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-white p-1',
          fixedBox,
        )}
      >
        <img src={logo} alt={name} className="h-full w-full object-contain" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl bg-primary/10',
        fallbackBox,
      )}
    >
      <Building2 className={cn(fallbackIcon, 'text-primary')} />
    </div>
  )
}
