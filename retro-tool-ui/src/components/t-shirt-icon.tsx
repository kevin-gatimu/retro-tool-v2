// Scale map: visual shirt size relative to container (XS smallest → XXL fills box)
const SHIRT_SCALES: Record<string, number> = {
  XS: 0.65,
  S: 0.74,
  M: 0.82,
  L: 0.89,
  XL: 0.95,
  XXL: 1.0,
}

export function getShirtScale(label: string): number {
  return SHIRT_SCALES[label.toUpperCase()] ?? 1.0
}

export function isTShirtTemplateName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('t-shirt') || lower.includes('t shirt')
}

export function TShirtIcon({
  label,
  themeColor,
  selected,
  scale = 1.0,
}: {
  label: string
  themeColor: string
  selected: boolean
  scale?: number
}) {
  const isSpecial = label === '☕'
  const isDotted = label === '?'
  const fill = selected ? themeColor : `${themeColor}22`
  const textFill = selected ? 'white' : themeColor

  // Shirt is scaled around its center (50, 55 in viewBox coords)
  const tx = (100 * (1 - scale)) / 2
  const ty = (110 * (1 - scale)) / 2

  // Torso center y stays at 55 + 15*scale after the transform
  const torsoCenterY = 55 + 15 * scale

  // Font size in SVG units — larger for short labels
  const fontSize = label.length >= 3 ? 17 : 21

  return (
    <svg viewBox="0 0 100 110" className="w-full h-full" aria-hidden="true">
      {/* Shirt body — scaled */}
      {!isSpecial && (
        <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
          <path
            d="M30,8 Q50,18 70,8 L92,8 L100,32 L78,38 L78,102 L22,102 L22,38 L0,32 L8,8 Z"
            fill={fill}
            stroke={themeColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeDasharray={isDotted ? '7 4' : undefined}
          />
          <path
            d="M30,8 Q50,18 70,8"
            fill="none"
            stroke="white"
            strokeWidth="2"
            opacity="0.4"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Label text — fixed visual size, tracks torso center */}
      <text
        x="50"
        y={isSpecial ? 55 : torsoCenterY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isSpecial ? themeColor : textFill}
        fontWeight="bold"
        fontSize={isSpecial ? 28 : fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.5"
      >
        {label}
      </text>
    </svg>
  )
}
