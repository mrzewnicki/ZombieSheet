import { useTranslation } from 'react-i18next'
import { useState, useRef, useCallback } from 'react'
import { ATTRIBUTE_GROUPS, SKILL_CATEGORIES } from '@/config/rpg-system'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import { heroFullName } from '@/types'
import { useChatContext } from '@/contexts/ChatContext'
import AttributeGroup from '@/components/hero/AttributeGroup'
import SkillCategory from '@/components/hero/SkillCategory'
import SkillThrowDialog, { type SkillThrowParams } from '@/components/hero/SkillThrowDialog'
import AttributeThrowDialog, { type AttributeThrowParams } from '@/components/hero/AttributeThrowDialog'
import { rollDicePool } from '@/utils/diceRoll'

const DEFAULT_ORDER = SKILL_CATEGORIES.map((c) => c.key)

function loadOrder(heroId: string): string[] {
  try {
    const raw = localStorage.getItem(`skillOrder_${heroId}`)
    if (!raw) return DEFAULT_ORDER
    const parsed: string[] = JSON.parse(raw)
    if (
      parsed.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every((k) => parsed.includes(k))
    ) return parsed
  } catch { /* ignore */ }
  return DEFAULT_ORDER
}

function saveOrder(heroId: string, order: string[]) {
  try { localStorage.setItem(`skillOrder_${heroId}`, JSON.stringify(order)) } catch { /* ignore */ }
}

export default function MechanicsTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)
  const [editing, setEditing] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const [order, setOrder] = useState<string[]>(() => loadOrder(heroId))
  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [throwTarget, setThrowTarget] = useState<{ key: string; label: string; value: number } | null>(null)
  const [attrThrowTarget, setAttrThrowTarget] = useState<{ key: string; label: string; value: number } | null>(null)

  const isEditable = canEdit && editing
  const { pushContextMessage } = useChatContext()

  const handleSkillThrow = useCallback((params: SkillThrowParams) => {
    if (!throwTarget) return
    const { rolls, result, diceCount } = rollDicePool(params.total)
    void pushContextMessage({
      type: 'dice_roll',
      heroId,
      heroName: heroFullName(hero),
      data: {
        key: throwTarget.key,
        label: throwTarget.label,
        skillValue: throwTarget.value,
        attributeKey: params.attributeKey,
        attributeLabel: params.attributeLabel,
        attributeValue: params.attributeValue,
        modifier: params.modifier,
        total: params.total,
        rolls,
        result,
        diceCount,
      },
    })
    setThrowTarget(null)
  }, [pushContextMessage, heroId, hero, throwTarget])

  const handleAttributeThrow = useCallback((params: AttributeThrowParams) => {
    if (!attrThrowTarget) return
    const { rolls, result, diceCount } = rollDicePool(params.total)
    void pushContextMessage({
      type: 'dice_roll',
      heroId,
      heroName: heroFullName(hero),
      data: {
        key: attrThrowTarget.key,
        label: attrThrowTarget.label,
        attributeValue: attrThrowTarget.value,
        skillKey: params.skillKey,
        skillLabel: params.skillLabel,
        skillValue: params.skillValue,
        modifier: params.modifier,
        total: params.total,
        rolls,
        result,
        diceCount,
      },
    })
    setAttrThrowTarget(null)
  }, [pushContextMessage, heroId, hero, attrThrowTarget])

  const orderedCategories = order
    .map((key) => SKILL_CATEGORIES.find((c) => c.key === key)!)
    .filter(Boolean)

  function onDragStart(idx: number) {
    dragIdx.current = idx
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx.current !== idx) setDragOverIdx(idx)
  }

  function onDrop(idx: number) {
    const from = dragIdx.current
    if (from === null || from === idx) return
    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    setOrder(next)
    saveOrder(heroId, next)
    dragIdx.current = null
    setDragOverIdx(null)
  }

  function onDragEnd() {
    dragIdx.current = null
    setDragOverIdx(null)
  }

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
        <div className="flex justify-end -mb-2">
          <button
            onClick={() => setEditing((e) => !e)}
            className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
              editing
                ? 'border-blood/50 text-blood bg-blood/10 hover:bg-blood/20'
                : 'border-blood/40 text-blood hover:bg-blood/10 hover:border-blood/70'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              {editing ? (
                <path d="M11 1a3 3 0 0 1 3 3v1h-1.5V4a1.5 1.5 0 0 0-3 0v1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7V4a4 4 0 0 1 4-3zM7 10a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1z"/>
              ) : (
                <path d="M8 1a3 3 0 0 0-3 3v1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V4a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v1H7V4zm1 5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1z"/>
              )}
            </svg>
            <span>{editing ? t('mechanics.lockEditing') : t('mechanics.unlockEditing')}</span>
          </button>
        </div>
      )}

      {/* Attributes */}
      <section>
        <h2 className="font-heading text-base text-blood-light tracking-widest uppercase mb-4">
          {t('attributes.title')}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {ATTRIBUTE_GROUPS.map((group) => (
            <AttributeGroup
              key={group.key}
              group={group}
              values={hero.attributes}
              onChange={isEditable ? handleAttrChange : undefined}
              onAttributeClick={(key, label, value) => setAttrThrowTarget({ key, label, value })}
              readOnly={!isEditable}
            />
          ))}
        </div>
      </section>

      {/* Skills */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="font-heading text-base text-blood-light tracking-widest uppercase">
            {t('skills.title')}
          </h2>
          <div className="ml-auto flex items-center gap-2">
          {order.join(',') !== DEFAULT_ORDER.join(',') && (
            <button
              onClick={() => { setOrder(DEFAULT_ORDER); saveOrder(heroId, DEFAULT_ORDER) }}
              className="text-xs font-mono px-2 py-1 rounded border border-border text-ink-faint bg-surface hover:border-blood/50 hover:text-blood hover:bg-blood/10 transition-colors"
              title={t('skills.resetOrder')}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
              </svg>
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-void border border-border rounded px-2.5 py-1 w-44 focus-within:border-blood/60 transition-colors">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="text-ink-faint shrink-0">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
            </svg>
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSkillSearch('') }}
              placeholder={t('skills.search')}
              className="bg-transparent text-xs text-ink placeholder-ink-faint focus:outline-none w-full"
            />
            {skillSearch && (
              <button
                onClick={() => setSkillSearch('')}
                className="shrink-0 text-blood hover:text-blood-light transition-colors leading-none"
                title={t('common.clear')}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                </svg>
              </button>
            )}
          </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {orderedCategories.map((cat, idx) => (
            <div
              key={cat.key}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={() => onDrop(idx)}
              onDragEnd={onDragEnd}
              className={`transition-all duration-150 ${
                dragIdx.current === idx ? 'opacity-40 scale-95' : ''
              } ${
                dragOverIdx === idx ? 'ring-1 ring-blood/60 rounded-lg' : ''
              }`}
            >
              <SkillCategory
                category={cat}
                values={hero.skills}
                onChange={isEditable ? handleSkillChange : undefined}
                onSkillClick={(key, label, value) => setThrowTarget({ key, label, value })}
                readOnly={!isEditable}
                search={skillSearch}
              />
            </div>
          ))}
        </div>
      </section>

      <SkillThrowDialog
        open={throwTarget !== null}
        skillLabel={throwTarget?.label ?? ''}
        skillValue={throwTarget?.value ?? 0}
        attributes={hero.attributes}
        onClose={() => setThrowTarget(null)}
        onThrow={handleSkillThrow}
      />

      <AttributeThrowDialog
        open={attrThrowTarget !== null}
        attributeLabel={attrThrowTarget?.label ?? ''}
        attributeValue={attrThrowTarget?.value ?? 0}
        skills={hero.skills}
        onClose={() => setAttrThrowTarget(null)}
        onThrow={handleAttributeThrow}
      />
    </div>
  )
}
