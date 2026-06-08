import type { GearTraitPolarity } from '@/types'
import {
  displayTraitValue,
  gearTraitPolarityClasses,
  gearTraitTooltipClasses,
} from '@/utils/gearTraits'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface Props {
  name: string
  polarity: GearTraitPolarity
  description?: string
  value?: number
}

export default function GearTraitChip({ name, polarity, description, value }: Props) {
  const hasDescription = Boolean(description?.trim())
  const displayValue = displayTraitValue(value)
  const hasValue = displayValue != null

  return (
    <span
      className="relative inline-flex group/trait"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span
        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${gearTraitPolarityClasses(polarity)}${hasDescription ? ' cursor-help' : ''}`}
      >
        {name}
        {hasValue && (
          <span className="ml-1 tabular-nums opacity-90">{displayValue}</span>
        )}
      </span>

      {hasDescription && (
        <div
          className="
            absolute left-0 bottom-full z-50 pb-1.5
            pointer-events-none group-hover/trait:pointer-events-auto
            opacity-0 group-hover/trait:opacity-100
            translate-y-0.5 group-hover/trait:translate-y-0
            transition-all duration-150
          "
          role="tooltip"
        >
          <div
            className={`max-w-xs min-w-[10rem] px-3 py-2 rounded border shadow-lg shadow-black/40 ${gearTraitTooltipClasses(polarity)}`}
          >
            <p className="text-[10px] font-mono uppercase tracking-wider mb-1.5 opacity-80">
              {name}
              {hasValue && <span className="ml-1 tabular-nums">{displayValue}</span>}
            </p>
            <div className="prose-hero text-xs normal-case tracking-normal font-body [&_p]:mb-1 [&_p:last-child]:mb-0">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {description}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}
