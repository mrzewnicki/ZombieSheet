import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearTraitDefinition, GearTraitPolarity } from '@/types'
import {
  findGearTraitByName,
  resolveGearTraits,
  upsertGearTrait,
  gearTraitPolarityClasses,
} from '@/utils/gearTraits'
import RichTextEditor from '@/components/ui/RichTextEditor'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface Props {
  gameId: string
  heroId: string
  traitIds: string[]
  catalog: GearTraitDefinition[]
  onChange: (traitIds: string[]) => void
  className?: string
}

type Draft = {
  name: string
  polarity: GearTraitPolarity
  description: string
  selectedId: string | null
}

const EMPTY_DRAFT: Draft = {
  name: '',
  polarity: 'positive',
  description: '',
  selectedId: null,
}

function PolarityToggle({
  value,
  onChange,
}: {
  value: GearTraitPolarity
  onChange: (polarity: GearTraitPolarity) => void
}) {
  const { t } = useTranslation()
  const options: GearTraitPolarity[] = ['positive', 'negative']

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest">
        {t('inventory.traits.polarityLabel')}
      </span>
      <div
        className="inline-flex w-fit rounded border border-border overflow-hidden"
        role="group"
        aria-label={t('inventory.traits.polarityLabel')}
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors border-r border-border last:border-r-0 ${
              value === opt
                ? gearTraitPolarityClasses(opt)
                : 'bg-surface text-ink-faint hover:text-ink hover:bg-elevated'
            }`}
          >
            {t(`inventory.traits.polarity.${opt}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

function TraitNamePicker({
  catalog,
  value,
  selectedId,
  onChange,
}: {
  catalog: GearTraitDefinition[]
  value: string
  selectedId: string | null
  onChange: (name: string, selectedId: string | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter((trait) => trait.name.toLowerCase().includes(q))
  }, [catalog, query])

  const displayValue = open ? query : value

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const item = listRef.current?.children[highlight] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open, filtered.length])

  function selectTrait(trait: GearTraitDefinition) {
    onChange(trait.name, trait.id)
    setOpen(false)
    setQuery('')
  }

  function applyFreeText(name: string) {
    const trimmed = name.trim()
    const match = findGearTraitByName(catalog, trimmed)
    onChange(trimmed, match?.id ?? null)
    setOpen(false)
    setQuery('')
  }

  function openList() {
    setOpen(true)
    setQuery(value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openList()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlight]) {
        selectTrait(filtered[highlight])
      } else if (query.trim()) {
        applyFreeText(query)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest">
        {t('inventory.traits.nameLabel')}
      </span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={displayValue}
        placeholder={t('inventory.traits.namePlaceholder')}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value, null)
          setOpen(true)
        }}
        onFocus={openList}
        onBlur={() => {
          if (query.trim() && query.trim() !== value) {
            applyFreeText(query)
          }
        }}
        onKeyDown={onKeyDown}
        className="w-full bg-void border border-border rounded px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-blood/50"
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded border border-border bg-surface py-1 shadow-xl shadow-black/30"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-faint">
              {query.trim()
                ? t('inventory.traits.createHint', { name: query.trim() })
                : t('inventory.traits.noCatalog')}
            </li>
          ) : (
            filtered.map((trait, idx) => (
              <li
                key={trait.id}
                role="option"
                aria-selected={selectedId === trait.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectTrait(trait)
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer border-b border-border/50 last:border-b-0 transition-colors ${
                  idx === highlight
                    ? 'bg-elevated text-ink border-l-2 border-l-blood/70 pl-[calc(0.75rem-2px)]'
                    : 'border-l-2 border-l-transparent text-ink-muted hover:bg-elevated/60 hover:text-ink'
                }`}
              >
                <span className="text-sm truncate">{trait.name}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${gearTraitPolarityClasses(trait.polarity)}`}
                >
                  {t(`inventory.traits.polarity.${trait.polarity}`)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function AssignedTrait({
  trait,
  onRemove,
}: {
  trait: GearTraitDefinition
  onRemove: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className={`rounded border px-3 py-2 space-y-1.5 ${gearTraitPolarityClasses(trait.polarity)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{trait.name}</span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs opacity-70 hover:opacity-100 transition-opacity"
          aria-label={t('inventory.traits.remove', { name: trait.name })}
        >
          ×
        </button>
      </div>
      {trait.description.trim() && (
        <div className="prose-hero text-xs opacity-90 [&_p]:mb-1 [&_p:last-child]:mb-0">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            remarkPlugins={[remarkGfm]}
          >
            {trait.description}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function GearTraitsEditor({
  gameId,
  heroId,
  traitIds,
  catalog,
  onChange,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const assigned = resolveGearTraits(traitIds, catalog)

  function handleNameChange(name: string, selectedId: string | null) {
    setDraft((prev) => {
      const next = { ...prev, name, selectedId }
      if (selectedId) {
        const trait = catalog.find((t) => t.id === selectedId)
        if (trait) {
          next.polarity = trait.polarity
          next.description = trait.description
        }
      }
      return next
    })
  }

  async function handleAdd() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const traitId = await upsertGearTrait(gameId, heroId, catalog, {
        name: draft.name,
        polarity: draft.polarity,
        description: draft.description,
      })
      if (!traitIds.includes(traitId)) {
        onChange([...traitIds, traitId])
      }
      setDraft(EMPTY_DRAFT)
      setAdding(false)
    } catch {
      setError(t('inventory.traits.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleRemove(traitId: string) {
    onChange(traitIds.filter((id) => id !== traitId))
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted uppercase tracking-widest">
          {t('inventory.traits.title')}
        </span>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-ink-faint hover:text-ink transition-colors"
          >
            + {t('inventory.traits.add')}
          </button>
        )}
      </div>

      {assigned.length > 0 && (
        <div className="space-y-2">
          {assigned.map((trait) => (
            <AssignedTrait
              key={trait.id}
              trait={trait}
              onRemove={() => handleRemove(trait.id)}
            />
          ))}
        </div>
      )}

      {assigned.length === 0 && !adding && (
        <p className="text-xs text-ink-faint italic">{t('inventory.traits.empty')}</p>
      )}

      {adding && (
        <div className="rounded border border-border bg-void/40 p-3 space-y-3">
          <TraitNamePicker
            catalog={catalog.filter((t) => !traitIds.includes(t.id))}
            value={draft.name}
            selectedId={draft.selectedId}
            onChange={handleNameChange}
          />

          <PolarityToggle
            value={draft.polarity}
            onChange={(polarity) => setDraft((prev) => ({ ...prev, polarity }))}
          />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted uppercase tracking-widest">
              {t('inventory.traits.descriptionLabel')}
            </span>
            <RichTextEditor
              placeholder={t('inventory.traits.descriptionPlaceholder')}
              rows={2}
              value={draft.description}
              onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
            />
          </div>

          <div className="flex gap-2 justify-end">
            {error && (
              <p className="text-blood text-xs self-center mr-auto">{error}</p>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY_DRAFT)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAdd}
              loading={saving}
              disabled={!draft.name.trim()}
            >
              {t('inventory.traits.confirmAdd')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
