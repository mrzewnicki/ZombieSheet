import { useTranslation } from 'react-i18next'
import type { SkillCategoryDef } from '@/config/rpg-system'

interface Props {
  category: SkillCategoryDef
  values: Record<string, number>
  onChange?: (key: string, value: number) => void
  readOnly?: boolean
  search?: string
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/40 text-ink rounded-sm px-px">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SkillCategory({ category, values, onChange, readOnly = false, search = '' }: Props) {
  const { t } = useTranslation()

  const visibleSkills = category.skills.filter((skill) =>
    !search || t(skill.labelKey).toLowerCase().includes(search.toLowerCase())
  )

  const hasMatch = !search || visibleSkills.length > 0
  const total = category.skills.reduce((sum, s) => sum + (values[s.key] ?? 0), 0)

  return (
    <div className={`bg-surface border border-border rounded-lg transition-opacity duration-150 ${!hasMatch ? 'opacity-30' : ''}`}>
      <div className="w-full flex items-center justify-between px-4 py-3 bg-elevated cursor-grab active:cursor-grabbing select-none">
        <span className="font-heading text-sm text-ink tracking-wide">
          {t(category.labelKey)}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">{total > 0 ? `Σ ${total}` : ''}</span>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-ink-faint opacity-40">
            <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </div>
      </div>

      <div className="divide-y divide-border">
        {category.skills.map((skill) => {
          const value = values[skill.key] ?? 0
          const label = t(skill.labelKey)
          const tooltip = t(`skillTooltips.${skill.key}`, { defaultValue: '' })
          return (
            <div key={skill.key} className="flex items-center justify-between px-4 py-2.5">
              <div className="relative group/skill">
                <span className="text-sm text-ink-muted cursor-default">
                  <Highlight text={label} query={search} />
                </span>
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
    </div>
  )
}
