import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SETTLEMENT_CONSTRUCTION_CATEGORIES,
  SETTLEMENT_CONSTRUCTIONS,
  constructionLocalizedDescription,
  constructionLocalizedName,
  type SettlementConstructionCategory,
  type SettlementConstructionDef,
} from '@/config/settlementConstructions'
import { SETTLEMENT_MATERIALS } from '@/config/settlementMaterials'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (catalogKey: string) => void
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

export default function ConstructionPicker({ open, onClose, onPick }: Props) {
  const { t, i18n } = useTranslation()
  const [category, setCategory] = useState<SettlementConstructionCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SETTLEMENT_CONSTRUCTIONS.filter((def) => {
      if (category !== 'all' && def.category !== category) return false
      if (!q) return true
      const name = constructionLocalizedName(def, i18n.language).toLowerCase()
      return name.includes(q) || def.key.includes(q)
    })
  }, [category, query, i18n.language])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-2xl">
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg text-ink">{t('settlement.addConstruction')}</h3>
            <Button variant="ghost" className="text-xs" onClick={onClose}>{t('common.close')}</Button>
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
          {items.length === 0 ? (
            <p className="text-sm text-ink-faint text-center py-6">{t('settlement.noConstructionResults')}</p>
          ) : (
            items.map((def) => (
              <button
                key={def.key}
                type="button"
                onClick={() => onPick(def.key)}
                className="w-full text-left rounded-lg border border-border bg-void/40 hover:bg-elevated/50 px-3 py-2.5 transition-colors"
              >
                <p className="text-sm text-ink font-medium">
                  {constructionLocalizedName(def, i18n.language)}
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
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
