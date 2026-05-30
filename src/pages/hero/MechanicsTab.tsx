import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ATTRIBUTE_GROUPS, SKILL_CATEGORIES } from '@/config/rpg-system'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import AttributeGroup from '@/components/hero/AttributeGroup'
import SkillCategory from '@/components/hero/SkillCategory'

export default function MechanicsTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)
  const [editing, setEditing] = useState(false)

  const isEditable = canEdit && editing

  async function handleAttrChange(key: string, value: number) {
    const label = t(`attributes.${key}`, { defaultValue: key })
    await updateField(`attributes.${key}`, label, value, hero.attributes[key] ?? 0)
  }

  async function handleSkillChange(key: string, value: number) {
    const label = t(`skills.${key}`, { defaultValue: key })
    await updateField(`skills.${key}`, label, value, hero.skills[key] ?? 0)
  }

  return (
    <div className="space-y-8">
      {/* Edit lock toggle — only for users with edit rights */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditing((e) => !e)}
            className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
              editing
                ? 'border-blood/50 text-blood bg-blood/10 hover:bg-blood/20'
                : 'border-border text-ink-faint hover:text-ink hover:border-border-light'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              {editing ? (
                /* open padlock — shackle lifted on right side */
                <path d="M11 1a3 3 0 0 1 3 3v1h-1.5V4a1.5 1.5 0 0 0-3 0v1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7V4a4 4 0 0 1 4-3zM7 10a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1z"/>
              ) : (
                /* closed padlock */
                <path d="M8 1a3 3 0 0 0-3 3v1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V4a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v1H7V4zm1 5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1z"/>
              )}
            </svg>
            <span>{editing ? t('mechanics.lockEditing') : t('mechanics.unlockEditing')}</span>
          </button>
        </div>
      )}

      {/* Attributes */}
      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
          {t('attributes.title')}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {ATTRIBUTE_GROUPS.map((group) => (
            <AttributeGroup
              key={group.key}
              group={group}
              values={hero.attributes}
              onChange={isEditable ? handleAttrChange : undefined}
              readOnly={!isEditable}
            />
          ))}
        </div>
      </section>

      {/* Skills */}
      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
          {t('skills.title')}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SKILL_CATEGORIES.map((cat) => (
            <SkillCategory
              key={cat.key}
              category={cat}
              values={hero.skills}
              onChange={isEditable ? handleSkillChange : undefined}
              readOnly={!isEditable}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
