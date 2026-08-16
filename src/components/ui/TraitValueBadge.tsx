import type { GearTraitPolarity } from '@/types'

/** Rank disc matching MarkdownViewer `.pros-cons-badge-num`. */
export default function TraitValueBadge({
  polarity,
  value,
}: {
  polarity: GearTraitPolarity
  value: number | string
}) {
  const fill = polarity === 'positive' ? 'bg-emerald-400' : 'bg-red-400'

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold leading-none tabular-nums text-void ${fill}`}
      style={{
        fontSize: '1.15em',
        minWidth: '1.35em',
        height: '1.35em',
        padding: '0 0.25em',
      }}
      aria-label={`ranga ${value}`}
    >
      {value}
    </span>
  )
}
