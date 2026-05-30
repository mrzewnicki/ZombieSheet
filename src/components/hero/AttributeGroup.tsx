import { useTranslation } from 'react-i18next'
import type { AttributeGroupDef } from '@/config/rpg-system'

interface Props {
  group: AttributeGroupDef
  values: Record<string, number>
  onChange?: (key: string, value: number) => void
  readOnly?: boolean
}

export default function AttributeGroup({ group, values, onChange, readOnly = false }: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Group header */}
      <div className="px-4 py-2 bg-elevated border-b border-border">
        <h3 className="font-heading text-sm text-ink tracking-wide">
          {t(group.labelKey)}
        </h3>
      </div>

      {/* Attributes */}
      <div className="divide-y divide-border">
        {group.attributes.map((attr) => {
          const value = values[attr.key] ?? 0

          const tooltip = t(`attributes.tooltips.${attr.key}`, { defaultValue: '' })
          return (
            <div key={attr.key} className="flex items-center justify-between px-4 py-3">
              <div className="relative group/attr">
                <span className="text-sm text-ink-muted cursor-default">{t(attr.labelKey)}</span>
                {tooltip && (
                  <div className="
                    pointer-events-none absolute left-0 bottom-full mb-2 z-50
                    w-56 px-3 py-2 rounded border border-border bg-void
                    text-xs text-ink-muted leading-snug shadow-lg
                    opacity-0 group-hover/attr:opacity-100
                    translate-y-1 group-hover/attr:translate-y-0
                    transition-all duration-150
                  ">
                    {tooltip}
                    <span className="absolute left-3 top-full border-4 border-transparent border-t-border" />
                  </div>
                )}
              </div>

              {readOnly ? (
                <span className="font-mono text-lg text-ink w-10 text-right">{value}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onChange?.(attr.key, Math.max(0, value - 1))}
                    className="w-7 h-7 rounded border border-border text-ink-muted hover:text-ink hover:border-blood transition-colors font-mono text-sm"
                    aria-label={`Zmniejsz ${t(attr.labelKey)}`}
                  >
                    −
                  </button>
                  <span className="font-mono text-lg text-ink w-8 text-center tabular-nums">
                    {value}
                  </span>
                  <button
                    onClick={() => onChange?.(attr.key, value + 1)}
                    className="w-7 h-7 rounded border border-border text-ink-muted hover:text-ink hover:border-blood transition-colors font-mono text-sm"
                    aria-label={`Zwiększ ${t(attr.labelKey)}`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
