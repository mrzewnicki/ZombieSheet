import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCog } from 'react-icons/fa'
import { SKILL_CATEGORIES } from '@/config/rpg-system'
import SkillCategory from '@/components/hero/SkillCategory'
import Button from '@/components/ui/Button'
import {
  DEFAULT_COMBAT_SKILL_KEYS,
  moveCombatSkillKey,
  normalizeCombatSkillKeys,
  resolveCombatSkills,
  toggleCombatSkillKey,
} from '@/utils/combatSkills'

interface Props {
  combatSkillKeys: unknown
  values: Record<string, number>
  canEdit: boolean
  className?: string
  onSkillChange?: (key: string, value: number) => void
  onSkillClick?: (key: string) => void
  onSaveKeys: (next: string[], prev: string[]) => Promise<void>
}

export default function CombatSkillsPanel({
  combatSkillKeys,
  values,
  canEdit,
  className = '',
  onSkillChange,
  onSkillClick,
  onSaveKeys,
}: Props) {
  const { t } = useTranslation()
  const savedKeys = useMemo(
    () => normalizeCombatSkillKeys(combatSkillKeys),
    [combatSkillKeys],
  )
  const pinnedSkills = useMemo(
    () => resolveCombatSkills(savedKeys),
    [savedKeys],
  )

  const [customizing, setCustomizing] = useState(false)
  const [draftKeys, setDraftKeys] = useState(savedKeys)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!customizing) setDraftKeys(savedKeys)
  }, [savedKeys, customizing])

  const walkaCategory = SKILL_CATEGORIES.find((c) => c.key === 'walka')!

  async function applyCustomization() {
    setSaving(true)
    try {
      await onSaveKeys(draftKeys, savedKeys)
      setCustomizing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelCustomization() {
    setDraftKeys(savedKeys)
    setCustomizing(false)
  }

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <SkillCategory
        category={walkaCategory}
        skillsOverride={pinnedSkills}
        titleKey="combat.skillsSection"
        showDragHandle={false}
        values={values}
        onChange={canEdit ? onSkillChange : undefined}
        onSkillClick={onSkillClick}
        readOnly={!canEdit}
        emptyMessage={t('combat.noSkillsPinned')}
        headerAction={canEdit ? (
          <button
            type="button"
            onClick={() => setCustomizing((open) => !open)}
            title={t('combat.customizeSkills')}
            aria-label={t('combat.customizeSkills')}
            className={`w-7 h-7 rounded border flex items-center justify-center transition-colors ${
              customizing
                ? 'border-blood-light text-blood-light bg-blood/20'
                : 'border-border text-ink-faint hover:text-ink bg-void/80'
            }`}
          >
            <FaCog className="w-3 h-3" aria-hidden />
          </button>
        ) : undefined}
      />

      {customizing && canEdit && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 space-y-3">
          <p className="text-xs text-ink-faint">{t('combat.customizeHint')}</p>

          {draftKeys.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('combat.pinnedOrder')}
              </p>
              <ul className="space-y-1">
                {draftKeys.map((key) => {
                  const skill = resolveCombatSkills([key])[0]
                  if (!skill) return null
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2 rounded border border-border/70 bg-void/40 px-2 py-1.5"
                    >
                      <span className="text-xs text-ink truncate">{t(skill.labelKey)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label={t('combat.moveSkillUp')}
                          className="w-6 h-6 rounded bg-elevated text-ink-faint hover:text-ink text-[10px]"
                          onClick={() => setDraftKeys((keys) => moveCombatSkillKey(keys, key, -1))}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={t('combat.moveSkillDown')}
                          className="w-6 h-6 rounded bg-elevated text-ink-faint hover:text-ink text-[10px]"
                          onClick={() => setDraftKeys((keys) => moveCombatSkillKey(keys, key, 1))}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={t('combat.removeSkill')}
                          className="w-6 h-6 rounded bg-elevated text-blood hover:text-blood-light text-[10px]"
                          onClick={() => setDraftKeys((keys) => toggleCombatSkillKey(keys, key))}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
            {SKILL_CATEGORIES.map((category) => (
              <div key={category.key}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
                  {t(category.labelKey)}
                </p>
                <ul className="space-y-1">
                  {category.skills.map((skill) => {
                    const checked = draftKeys.includes(skill.key)
                    return (
                      <li key={skill.key}>
                        <label className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setDraftKeys((keys) => toggleCombatSkillKey(keys, skill.key))}
                            className="accent-blood"
                          />
                          <span>{t(skill.labelKey)}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              className="text-xs"
              disabled={saving}
              onClick={() => void applyCustomization()}
            >
              {t('common.save')}
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={saving}
              onClick={cancelCustomization}
            >
              {t('common.cancel')}
            </Button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setDraftKeys([...DEFAULT_COMBAT_SKILL_KEYS])}
              className="text-xs font-mono text-ink-faint hover:text-blood transition-colors ml-auto"
            >
              {t('combat.resetSkills')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
