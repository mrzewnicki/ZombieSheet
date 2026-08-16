import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SETTLEMENT_CONSTRUCTION_CATEGORIES,
  SETTLEMENT_CONSTRUCTIONS,
  constructionLocalizedDescription,
  constructionLocalizedName,
  customConstructionAsDef,
  type SettlementConstructionCategory,
  type SettlementConstructionDef,
} from '@/config/settlementConstructions'
import { SETTLEMENT_MATERIALS } from '@/config/settlementMaterials'
import { settlementConstructionIcon } from '@/config/settlementConstructionIcons'
import type { SettlementCustomConstruction } from '@/types'
import GearIcon from '@/components/hero/GearIcon'
import GearIconPicker from '@/components/hero/GearIconPicker'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export interface CreateCustomConstructionInput {
  name: string
  description: string
  category: SettlementConstructionCategory
  complexity: number
  time: number
  icon: string
}

interface Props {
  open: boolean
  onClose: () => void
  onPick: (catalogKey: string) => void
  customConstructions?: SettlementCustomConstruction[]
  onCreateCustom?: (input: CreateCustomConstructionInput) => void
}

function materialCostLabel(
  def: SettlementConstructionDef,
  t: (key: string) => string,
): string {
  const parts = SETTLEMENT_MATERIALS
    .filter((m) => (def.materials[m.key] ?? 0) > 0)
    .map((m) => `${t(m.labelKey)} × ${def.materials[m.key]}`)
  return parts.length > 0 ? parts.join(', ') : '—'
}

export default function ConstructionPicker({
  open,
  onClose,
  onPick,
  customConstructions = [],
  onCreateCustom,
}: Props) {
  const { t, i18n } = useTranslation()
  const [category, setCategory] = useState<SettlementConstructionCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState<SettlementConstructionCategory>('podstawowe')
  const [newComplexity, setNewComplexity] = useState(1)
  const [newTime, setNewTime] = useState(1)
  const [newIcon, setNewIcon] = useState('')

  const customDefs = useMemo(
    () => customConstructions.map(customConstructionAsDef),
    [customConstructions],
  )

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const catalog = [...SETTLEMENT_CONSTRUCTIONS, ...customDefs]
    return catalog.filter((def) => {
      if (category !== 'all' && def.category !== category) return false
      if (!q) return true
      const name = constructionLocalizedName(def, i18n.language).toLowerCase()
      return name.includes(q) || def.key.includes(q)
    })
  }, [category, customDefs, query, i18n.language])

  function resetCreateForm() {
    setCreating(false)
    setNewName('')
    setNewDescription('')
    setNewCategory('podstawowe')
    setNewComplexity(1)
    setNewTime(1)
    setNewIcon('')
  }

  function submitCreate() {
    const name = newName.trim() || query.trim()
    if (!name || !onCreateCustom) return
    onCreateCustom({
      name,
      description: newDescription.trim(),
      category: newCategory,
      complexity: Math.max(1, newComplexity),
      time: Math.max(1, newTime),
      icon: newIcon.trim(),
    })
    resetCreateForm()
    setQuery('')
  }

  if (!open) return null

  const trimmedQuery = query.trim()
  const canQuickCreate = Boolean(onCreateCustom && trimmedQuery)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={() => {
          resetCreateForm()
          onClose()
        }}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-2xl">
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg text-ink">{t('settlement.addConstruction')}</h3>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => {
                resetCreateForm()
                onClose()
              }}
            >
              {t('common.close')}
            </Button>
          </div>
          <Input
            search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settlement.searchConstructions')}
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${
                category === 'all' ? 'border-blood/50 text-blood-light bg-blood/10' : 'border-border text-ink-muted'
              }`}
            >
              {t('settlement.categoryAll')}
            </button>
            {SETTLEMENT_CONSTRUCTION_CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${
                  category === key ? 'border-blood/50 text-blood-light bg-blood/10' : 'border-border text-ink-muted'
                }`}
              >
                {t(`settlement.categories.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {items.length === 0 && !creating ? (
            <p className="text-sm text-ink-faint text-center py-6">{t('settlement.noConstructionResults')}</p>
          ) : (
            items.map((def) => {
              const FallbackIcon = settlementConstructionIcon(def.key, def.category)
              const isCustom = customDefs.some((c) => c.key === def.key)
              return (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => onPick(def.key)}
                  className="w-full text-left rounded-lg border border-border bg-void/40 hover:bg-elevated/50 px-3 py-2.5 transition-colors flex items-start gap-3"
                >
                  <span
                    className="w-9 h-9 rounded-md border border-border flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>i]:text-base"
                    style={{ backgroundColor: '#231c16', color: '#b02020' }}
                  >
                    {def.icon ? (
                      <GearIcon value={def.icon} className="w-4 h-4" />
                    ) : (
                      <FallbackIcon className="w-4 h-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <p className="text-sm text-ink font-medium flex items-center gap-2">
                      <span className="truncate">{constructionLocalizedName(def, i18n.language)}</span>
                      {isCustom && (
                        <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-ink-faint border border-border px-1 py-0.5 rounded">
                          {t('settlement.customConstructionBadge')}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {t('settlement.complexity')}: {def.complexity}
                      {' · '}
                      {t('settlement.time')}: {def.time}
                      {' · '}
                      {materialCostLabel(def, t)}
                    </p>
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                      {constructionLocalizedDescription(def, i18n.language)}
                    </p>
                  </span>
                </button>
              )
            })
          )}
        </div>

        {onCreateCustom && (
          <div className="shrink-0 border-t border-border px-3 py-3 space-y-2 bg-void/30">
            {!creating ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setCreating(true)
                    if (trimmedQuery && !newName) setNewName(trimmedQuery)
                  }}
                >
                  {t('settlement.createCustomConstruction')}
                </Button>
                {canQuickCreate && (
                  <Button
                    variant="ghost"
                    className="text-xs text-blood-light"
                    onClick={() => {
                      onCreateCustom({
                        name: trimmedQuery,
                        description: '',
                        category: category === 'all' ? 'podstawowe' : category,
                        complexity: 1,
                        time: 1,
                        icon: '',
                      })
                      setQuery('')
                    }}
                  >
                    {t('settlement.createCustomConstructionNamed', { name: trimmedQuery })}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {t('settlement.createCustomConstruction')}
                </p>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('settlement.customConstructionName')}
                  autoFocus
                />
                <GearIconPicker
                  label={t('inventory.visual.icon')}
                  value={newIcon}
                  onChange={setNewIcon}
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('settlement.customConstructionDescription')}
                  rows={2}
                  className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink resize-y"
                />
                <div className="grid grid-cols-3 gap-2">
                  <label className="block space-y-1 col-span-3 sm:col-span-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {t('settlement.constructionCategory')}
                    </span>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as SettlementConstructionCategory)}
                      className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                    >
                      {SETTLEMENT_CONSTRUCTION_CATEGORIES.map((key) => (
                        <option key={key} value={key}>
                          {t(`settlement.categories.${key}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {t('settlement.complexity')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={newComplexity}
                      onChange={(e) => setNewComplexity(Number(e.target.value) || 1)}
                      className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {t('settlement.time')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={newTime}
                      onChange={(e) => setNewTime(Number(e.target.value) || 1)}
                      className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" className="text-xs" onClick={resetCreateForm}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    className="text-xs"
                    disabled={!newName.trim()}
                    onClick={submitCreate}
                  >
                    {t('settlement.saveCustomConstruction')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
