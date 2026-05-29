import { useTranslation } from 'react-i18next'
import type { SkillCategoryDef } from '@/config/rpg-system'

interface Props {
  category: SkillCategoryDef
  values: Record<string, number>
  onChange?: (key: string, value: number) => void
  readOnly?: boolean
}

export default function SkillCategory({ category, values, onChange, readOnly = false }: Props) {
  const { t } = useTranslation()
  const open = true

  const total = category.skills.reduce((sum, s) => sum + (values[s.key] ?? 0), 0)

  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Category header — toggle */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-elevated">
        <span className="font-heading text-sm text-ink tracking-wide">
          {t(category.labelKey)}
        </span>
        <span className="font-mono text-xs text-ink-faint">{total > 0 ? `Σ ${total}` : ''}</span>
      </div>

      {/* Skills list */}
      {open && (
        <div className="divide-y divide-border">
          {category.skills.map((skill) => {
            const value = values[skill.key] ?? 0
            const tooltip = t(`skillTooltips.${skill.key}`, { defaultValue: '' })
            return (
              <div key={skill.key} className="flex items-center justify-between px-4 py-2.5">
                <div className="relative group/skill">
                  <span className="text-sm text-ink-muted cursor-default">{t(skill.labelKey)}</span>
                  {tooltip && (
                    <div className="
                      pointer-events-none absolute left-0 bottom-full mb-2 z-50
                      w-56 px-3 py-2 rounded border border-border bg-void
                      text-xs text-ink-muted leading-snug shadow-lg
                      opacity-0 group-hover/skill:opacity-100
                      translate-y-1 group-hover/skill:translate-y-0
                      transition-all duration-150
                    ">
                      {tooltip}
                      <span className="absolute left-3 top-full border-4 border-transparent border-t-border" />
                    </div>
                  )}
                </div>

                {readOnly ? (
                  <span className="font-mono text-base text-ink w-8 text-right">{value}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onChange?.(skill.key, Math.max(0, value - 1))}
                      className="w-6 h-6 rounded border border-border text-ink-faint hover:text-ink hover:border-blood transition-colors font-mono text-xs"
                    >
                      −
                    </button>
                    <span className="font-mono text-base text-ink w-6 text-center tabular-nums">
                      {value}
                    </span>
                    <button
                      onClick={() => onChange?.(skill.key, value + 1)}
                      className="w-6 h-6 rounded border border-border text-ink-faint hover:text-ink hover:border-blood transition-colors font-mono text-xs"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
