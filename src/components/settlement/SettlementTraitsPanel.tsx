import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { SETTLEMENT_CONSTRUCTIONS } from '@/config/settlementConstructions'
import { SETTLEMENT_MATERIALS } from '@/config/settlementMaterials'
import { useGearTraitCatalog } from '@/hooks/useGearTraitCatalog'
import type { GearTraitDefinition, SettlementTraitLine, SettlementTraitPolarity } from '@/types'
import { gearTraitPolarityClasses } from '@/utils/gearTraits'
import { newSettlementTrait } from '@/utils/settlement'
import { parseSettlementProperties } from '@/utils/settlementProperties'

interface Props {
  gameId: string
  traits: SettlementTraitLine[]
  canEdit: boolean
  onChange: (traits: SettlementTraitLine[]) => void
}

interface TraitSuggestion {
  key: string
  name: string
  description: string
  polarity: SettlementTraitPolarity
  source: 'catalog' | 'construction'
}

function polarityFromGear(p: GearTraitDefinition['polarity']): SettlementTraitPolarity {
  return p === 'negative' ? 'negative' : 'positive'
}

function buildConstructionSuggestions(): TraitSuggestion[] {
  const byName = new Map<string, TraitSuggestion>()
  const sources = [
    ...SETTLEMENT_MATERIALS.map((m) => m.properties),
    ...SETTLEMENT_CONSTRUCTIONS.map((c) => c.properties),
  ]
  for (const raw of sources) {
    for (const tag of parseSettlementProperties(raw)) {
      const polarity = tag.polarity === 'negative' ? 'negative' : 'positive'
      const key = `${polarity}:${tag.name.toLocaleLowerCase('pl')}`
      if (byName.has(key)) continue
      byName.set(key, {
        key,
        name: tag.name,
        description: '',
        polarity,
        source: 'construction',
      })
    }
  }
  return [...byName.values()]
}

const CONSTRUCTION_SUGGESTIONS = buildConstructionSuggestions()

function filterSuggestions(
  suggestions: TraitSuggestion[],
  query: string,
  polarity: SettlementTraitPolarity,
): TraitSuggestion[] {
  const q = query.trim().toLocaleLowerCase('pl')
  return suggestions
    .filter((s) => s.polarity === polarity)
    .filter((s) => !q || s.name.toLocaleLowerCase('pl').includes(q))
    .slice(0, 12)
}

function TraitNameField({
  value,
  polarity,
  suggestions,
  placeholder,
  onChange,
  onPick,
}: {
  value: string
  polarity: SettlementTraitPolarity
  suggestions: TraitSuggestion[]
  placeholder: string
  onChange: (name: string) => void
  onPick: (suggestion: TraitSuggestion) => void
}) {
  const { t } = useTranslation()
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const filtered = useMemo(
    () => filterSuggestions(suggestions, value, polarity),
    [suggestions, value, polarity],
  )

  useEffect(() => {
    setHighlight(0)
  }, [value, polarity])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pick(s: TraitSuggestion) {
    onPick(s)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
            return
          }
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && filtered[highlight]) {
            e.preventDefault()
            pick(filtered[highlight])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
          }
        }}
        className="w-full"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded border border-border bg-surface py-1 shadow-xl shadow-black/30"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-faint">
              {value.trim()
                ? t('settlement.traitSuggestCreate', { name: value.trim() })
                : t('settlement.traitSuggestEmpty')}
            </li>
          ) : (
            filtered.map((s, idx) => (
              <li
                key={s.key}
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s)
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer border-b border-border/40 last:border-b-0 ${
                  idx === highlight
                    ? 'bg-elevated text-ink'
                    : 'text-ink-muted hover:bg-elevated/60 hover:text-ink'
                }`}
              >
                <span className="text-sm truncate min-w-0">{s.name}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${gearTraitPolarityClasses(s.polarity)}`}
                >
                  {s.source === 'catalog'
                    ? t('settlement.traitSuggestCatalog')
                    : t('settlement.traitSuggestConstruction')}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default function SettlementTraitsPanel({
  gameId,
  traits,
  canEdit,
  onChange,
}: Props) {
  const { t } = useTranslation()
  const { traits: catalog } = useGearTraitCatalog(gameId)

  const suggestions = useMemo(() => {
    const fromCatalog: TraitSuggestion[] = catalog.map((trait) => ({
      key: `catalog:${trait.id}`,
      name: trait.name,
      description: trait.description,
      polarity: polarityFromGear(trait.polarity),
      source: 'catalog' as const,
    }))
    const seen = new Set(fromCatalog.map((s) => `${s.polarity}:${s.name.toLocaleLowerCase('pl')}`))
    const extras = CONSTRUCTION_SUGGESTIONS.filter((s) => {
      const key = `${s.polarity}:${s.name.toLocaleLowerCase('pl')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...fromCatalog, ...extras].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }, [catalog])

  function update(id: string, patch: Partial<SettlementTraitLine>) {
    onChange(traits.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function remove(id: string) {
    onChange(traits.filter((item) => item.id !== id))
  }

  function add(polarity: SettlementTraitPolarity) {
    onChange([...traits, newSettlementTrait(polarity)])
  }

  function applySuggestion(id: string, suggestion: TraitSuggestion) {
    update(id, {
      name: suggestion.name,
      description: suggestion.description || traits.find((x) => x.id === id)?.description || '',
      polarity: suggestion.polarity,
    })
  }

  const atuty = traits.filter((item) => item.polarity === 'positive')
  const wady = traits.filter((item) => item.polarity === 'negative')

  function renderGroup(list: SettlementTraitLine[], polarity: SettlementTraitPolarity) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-xs font-mono uppercase tracking-widest ${
            polarity === 'positive' ? 'text-emerald-400/80' : 'text-blood'
          }`}>
            {polarity === 'positive' ? t('settlement.atuty') : t('settlement.wady')}
          </h4>
          {canEdit && (
            <Button variant="outline" className="text-[10px] py-1" onClick={() => add(polarity)}>
              {t('common.add')}
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-ink-faint">{t('settlement.noTraits')}</p>
        ) : (
          list.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-void/40 px-3 py-2 space-y-2">
              {canEdit ? (
                <>
                  <div className="flex gap-2">
                    <TraitNameField
                      value={item.name}
                      polarity={polarity}
                      suggestions={suggestions}
                      placeholder={t('settlement.traitName')}
                      onChange={(name) => update(item.id, { name })}
                      onPick={(s) => applySuggestion(item.id, s)}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.value}
                      onChange={(e) => update(item.id, { value: Number(e.target.value) || 0 })}
                      className="w-16"
                      aria-label={t('settlement.traitValue')}
                    />
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) => update(item.id, { description: e.target.value })}
                    placeholder={t('settlement.traitDescription')}
                    rows={2}
                    className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink resize-y min-h-[2.5rem]"
                  />
                  <Button variant="danger" className="text-[10px] py-1" onClick={() => remove(item.id)}>
                    {t('common.delete')}
                  </Button>
                </>
              ) : (
                <div>
                  <p className="text-sm text-ink font-medium">
                    {item.name || t('settlement.unnamedTrait')}
                    {item.value > 0 && <span className="text-ink-faint font-mono"> ({item.value})</span>}
                  </p>
                  {item.description && (
                    <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{item.description}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
        {t('settlement.traitsSection')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {renderGroup(atuty, 'positive')}
        {renderGroup(wady, 'negative')}
      </div>
    </section>
  )
}
