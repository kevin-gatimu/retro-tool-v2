import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  EstimateTemplate,
  EstimateTemplateValue,
} from '@/common/types/estimates'

// ============================================================================
// T-shirt SVG
// ============================================================================

function TShirtSvg({ color, scale = 1 }: { color: string; scale?: number }) {
  const w = Math.round(28 * scale)
  const h = Math.round(35 * scale)
  return (
    <svg
      viewBox="0 0 16 20"
      width={w}
      height={h}
      style={{ color, display: 'inline-block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Body */}
      <path
        d="M5,4 L2,7 L0,5 L2,17 L14,17 L16,5 L14,7 L11,4 Q8,6.5 5,4Z"
        fill="currentColor"
      />
      {/* Collar highlight */}
      <ellipse cx="8" cy="4.5" rx="3" ry="1.2" fill="white" opacity="0.3" />
      {/* Left sleeve shadow */}
      <path d="M2,7 L0,5 L2,9Z" fill="black" opacity="0.2" />
      {/* Right sleeve shadow */}
      <path d="M14,7 L16,5 L14,9Z" fill="black" opacity="0.2" />
      {/* Bottom fold */}
      <line
        x1="2"
        y1="17"
        x2="14"
        y2="17"
        stroke="black"
        strokeWidth="0.3"
        opacity="0.3"
      />
    </svg>
  )
}

// ============================================================================
// Template style detection
// ============================================================================

type TemplateStyle = 'tshirt' | 'risk' | 'easy-med-hard' | 'dots' | 'default'

function detectStyle(name: string): TemplateStyle {
  const n = name.toLowerCase()
  if (n.includes('t-shirt') || n.includes('t shirt') || n.includes('tshirt'))
    return 'tshirt'
  if (n.includes('risk')) return 'risk'
  if (n.includes('easy') || n.includes('medium') || n.includes('hard'))
    return 'easy-med-hard'
  if (n.includes('dot')) return 'dots'
  return 'default'
}

const TSHIRT_SCALES: Record<string, number> = {
  XS: 0.75,
  S: 0.85,
  M: 1.0,
  L: 1.15,
  XL: 1.3,
  XXL: 1.45,
}

// ============================================================================
// Value renderers
// ============================================================================

function TShirtValues({
  values,
  color,
}: {
  values: EstimateTemplateValue[]
  color: string
}) {
  const nonSpecial = values.filter((v) => v.value !== '?')
  return (
    <div className="flex items-end gap-1.5 flex-wrap">
      {nonSpecial.map((v) => {
        const scale = TSHIRT_SCALES[v.label] ?? 1.0
        return (
          <div key={v.id} className="flex flex-col items-center gap-0.5">
            <TShirtSvg color={color} scale={scale} />
            <span className="text-[10px] font-semibold text-muted-foreground">
              {v.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ColoredBadgeValues({ values }: { values: EstimateTemplateValue[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: v.color ?? '#6b7280' }}
        >
          {v.label}
        </span>
      ))}
    </div>
  )
}

function DotsValues({
  values,
  color,
}: {
  values: EstimateTemplateValue[]
  color: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-mono font-bold bg-muted"
          style={{ color }}
        >
          {v.label}
        </span>
      ))}
    </div>
  )
}

function DefaultValues({
  values,
  color,
}: {
  values: EstimateTemplateValue[]
  color: string
}) {
  const MAX_SHOWN = 10
  const shown = values.slice(0, MAX_SHOWN)
  const overflow = values.length - MAX_SHOWN
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted"
          style={{ color }}
        >
          {v.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

interface EstimateTemplateCardProps {
  template: EstimateTemplate
  selected?: boolean
  onSelect?: () => void
  showActions?: boolean
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function EstimateTemplateCard({
  template,
  selected,
  onSelect,
  showActions,
  onEdit,
  onDelete,
  className,
}: EstimateTemplateCardProps) {
  const style = detectStyle(template.name)
  const themeColor = template.color ?? '#6366f1'

  const renderValues = () => {
    if (style === 'tshirt') {
      return <TShirtValues values={template.values} color={themeColor} />
    }
    if (style === 'risk' || style === 'easy-med-hard') {
      return <ColoredBadgeValues values={template.values} />
    }
    if (style === 'dots') {
      return <DotsValues values={template.values} color={themeColor} />
    }
    return <DefaultValues values={template.values} color={themeColor} />
  }

  return (
    <Card
      className={cn(
        'transition-all duration-150',
        onSelect && 'cursor-pointer hover:shadow-md',
        selected && 'ring-2 ring-primary ring-offset-2 border-primary',
        className,
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {template.name}
            </p>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {template.isBuiltIn ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Built-in
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {template.organizationName ?? 'Org'}
              </Badge>
            )}
            {showActions && (
              <div
                className="flex gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onEdit}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="overflow-x-auto">{renderValues()}</div>
      </CardContent>
    </Card>
  )
}
