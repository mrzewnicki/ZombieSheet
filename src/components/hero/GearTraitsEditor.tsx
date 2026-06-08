import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearTraitCategory, GearTraitDefinition, GearTraitPolarity, GearTraitScopeCategory, GearTraitValues } from '@/types'
import {
  DEFAULT_GEAR_TRAIT_VALUE,
  displayTraitValue,
  filterTraitsForScope,
  findGearTraitByNameInScope,
  resolveTraitValueFromInput,
  pruneTraitValues,
  resolveGearTraits,
  resolveGearTraitValue,
  sortTraitsForPicker,
  upsertGearTrait,
  updateGearTrait,
  gearTraitPolarityClasses,
} from '@/utils/gearTraits'
import RichTextEditor from '@/components/ui/RichTextEditor'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface Props {
  gameId: string
  heroId: string
  scopeCategory: GearTraitScopeCategory
  traitIds: string[]
  traitValues?: GearTraitValues
  catalog: GearTraitDefinition[]
  onChange: (traitIds: string[], traitValues?: GearTraitValues) => void
  className?: string
}

type Draft = {
  name: string
  polarity: GearTraitPolarity
  description: string
  selectedId: string | null
  value: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  polarity: 'positive',
  description: '',
  selectedId: null,
  value: '',
}

function TraitCategoryBadge({ category }: { category: GearTraitCategory }) {
  const { t } = useTranslation()
  return (
    <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-ink-faint/80">
      {t(`inventory.traits.category.${category}`)}
    </span>
  )
}

function PolarityIcon({ polarity }: { polarity: GearTraitPolarity }) {
  if (polarity === 'positive') {
    return (
      <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 shrink-0" aria-hidden>
        <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 shrink-0" aria-hidden>
      <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
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
            aria-label={t(`inventory.traits.polarity.${opt}`)}
            title={t(`inventory.traits.polarity.${opt}`)}
            onClick={() => onChange(opt)}
            className={`flex items-center justify-center w-9 h-9 transition-colors border-r border-border last:border-r-0 ${
              value === opt
                ? gearTraitPolarityClasses(opt)
                : 'bg-surface text-ink-faint hover:text-ink hover:bg-elevated'
            }`}
          >
            <PolarityIcon polarity={opt} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TraitNamePicker({
  catalog,
  lookupCatalog,
  scopeCategory,
  value,
  selectedId,
  onChange,
}: {
  catalog: GearTraitDefinition[]
  lookupCatalog: GearTraitDefinition[]
  scopeCategory: GearTraitScopeCategory
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
    const list = q
      ? catalog.filter((trait) => trait.name.toLowerCase().includes(q))
      : catalog
    return sortTraitsForPicker(list, scopeCategory)
  }, [catalog, query, scopeCategory])

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
    const match = findGearTraitByNameInScope(lookupCatalog, trimmed, scopeCategory)
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
                <span className="text-sm truncate min-w-0">{trait.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <TraitCategoryBadge category={trait.category} />
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${gearTraitPolarityClasses(trait.polarity)}`}
                  >
                    {t(`inventory.traits.polarity.${trait.polarity}`)}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function draftFromTrait(trait: GearTraitDefinition, value?: number): Draft {
  const resolved = value ?? DEFAULT_GEAR_TRAIT_VALUE
  return {
    name: trait.name,
    polarity: trait.polarity,
    description: trait.description,
    selectedId: trait.id,
    value: resolved > DEFAULT_GEAR_TRAIT_VALUE ? String(resolved) : '',
  }
}

function TraitEditorPanel({
  mode,
  draft,
  catalog,
  lookupCatalog,
  scopeCategory,
  saving,
  error,
  onNameChange,
  onDraftChange,
  onSave,
  onCancel,
}: {
  mode: 'add' | 'edit'
  draft: Draft
  catalog: GearTraitDefinition[]
  lookupCatalog: GearTraitDefinition[]
  scopeCategory: GearTraitScopeCategory
  saving: boolean
  error: string
  onNameChange: (name: string, selectedId: string | null) => void
  onDraftChange: (patch: Partial<Draft>) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded border border-border bg-void/40 p-3 space-y-3">
      <TraitNamePicker
        catalog={catalog}
        lookupCatalog={lookupCatalog}
        scopeCategory={scopeCategory}
        value={draft.name}
        selectedId={draft.selectedId}
        onChange={onNameChange}
      />

      <div className="flex flex-wrap items-end gap-4">
        <PolarityToggle
          value={draft.polarity}
          onChange={(polarity) => onDraftChange({ polarity })}
        />

        <div className="w-20">
          <Input
            label={t('inventory.traits.valueLabel')}
            type="number"
            min={1}
            max={10}
            placeholder={t('inventory.traits.valuePlaceholder')}
            value={draft.value}
            onChange={(e) => onDraftChange({ value: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted uppercase tracking-widest">
          {t('inventory.traits.descriptionLabel')}
        </span>
        <RichTextEditor
          placeholder={t('inventory.traits.descriptionPlaceholder')}
          rows={2}
          value={draft.description}
          onChange={(description) => onDraftChange({ description })}
        />
      </div>

      <div className="flex gap-2 justify-end">
        {error && (
          <p className="text-blood text-xs self-center mr-auto">{error}</p>
        )}
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onSave}
          loading={saving}
          disabled={!draft.name.trim()}
        >
          {mode === 'add' ? t('inventory.traits.confirmAdd') : t('common.save')}
        </Button>
      </div>
    </div>
  )
}

function AssignedTrait({
  trait,
  value,
  scopeCategory,
  editing,
  onEdit,
  onRemove,
}: {
  trait: GearTraitDefinition
  value?: number
  scopeCategory: GearTraitScopeCategory
  editing: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const displayValue = displayTraitValue(value)

  if (editing) return null

  return (
    <div
      className={`rounded border px-3 py-2 space-y-1.5 ${gearTraitPolarityClasses(trait.polarity)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium leading-snug">
            {trait.name}
            {displayValue != null && (
              <span className="ml-1.5 font-mono tabular-nums text-xs opacity-90">
                {displayValue}
              </span>
            )}
          </span>
          {trait.category !== scopeCategory && (
            <span className="block mt-0.5">
              <TraitCategoryBadge category={trait.category} />
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity"
            aria-label={t('inventory.traits.edit', { name: trait.name })}
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity"
            aria-label={t('inventory.traits.remove', { name: trait.name })}
          >
            ×
          </button>
        </div>
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
  scopeCategory,
  traitIds,
  traitValues,
  catalog,
  onChange,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const assigned = resolveGearTraits(traitIds, catalog)
  const formOpen = adding || editingId != null

  function resetForm() {
    setAdding(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setError('')
  }

  function handleNameChange(name: string, selectedId: string | null) {
    setDraft((prev) => {
      const next = { ...prev, name, selectedId }
      if (selectedId && selectedId !== editingId) {
        const trait = catalog.find((t) => t.id === selectedId)
        if (trait) {
          next.polarity = trait.polarity
          next.description = trait.description
        }
      }
      return next
    })
  }

  function applyTraitValues(traitId: string, previousId?: string) {
    const value = resolveTraitValueFromInput(draft.value)
    const nextValues = { ...traitValues }
    if (previousId && previousId !== traitId) delete nextValues[previousId]
    if (value > DEFAULT_GEAR_TRAIT_VALUE) nextValues[traitId] = value
    else delete nextValues[traitId]
    return nextValues
  }

  function replaceTraitId(previousId: string, nextId: string) {
    const nextIds = traitIds.map((id) => (id === previousId ? nextId : id))
    const deduped = nextIds.filter((id, index) => nextIds.indexOf(id) === index)
    const nextValues = applyTraitValues(nextId, previousId)
    onChange(deduped, pruneTraitValues(deduped, nextValues))
  }

  async function handleAdd() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const input = {
        name: draft.name,
        polarity: draft.polarity,
        description: draft.description,
      }
      let traitId: string

      if (draft.selectedId) {
        traitId = await updateGearTrait(gameId, draft.selectedId, catalog, input)
      } else {
        const match = findGearTraitByNameInScope(catalog, draft.name, scopeCategory)
        if (match) {
          traitId = await updateGearTrait(gameId, match.id, catalog, input)
        } else {
          traitId = await upsertGearTrait(gameId, heroId, catalog, {
            ...input,
            category: scopeCategory,
          })
        }
      }

      const nextIds = traitIds.includes(traitId) ? traitIds : [...traitIds, traitId]
      const nextValues = applyTraitValues(traitId)
      onChange(nextIds, pruneTraitValues(nextIds, nextValues))
      resetForm()
    } catch {
      setError(t('inventory.traits.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingId || !draft.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const traitId = await updateGearTrait(gameId, editingId, catalog, {
        name: draft.name,
        polarity: draft.polarity,
        description: draft.description,
      })
      replaceTraitId(editingId, traitId)
      resetForm()
    } catch {
      setError(t('inventory.traits.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleRemove(traitId: string) {
    if (editingId === traitId) resetForm()
    const nextIds = traitIds.filter((id) => id !== traitId)
    const nextValues = { ...traitValues }
    delete nextValues[traitId]
    onChange(nextIds, pruneTraitValues(nextIds, nextValues))
  }

  function startEdit(trait: GearTraitDefinition) {
    setAdding(false)
    setEditingId(trait.id)
    setDraft(draftFromTrait(trait, resolveGearTraitValue(trait.id, traitValues)))
    setError('')
  }

  const scopedCatalog = filterTraitsForScope(catalog, scopeCategory)
  const pickerCatalog = adding
    ? scopedCatalog.filter((t) => !traitIds.includes(t.id))
    : scopedCatalog.filter((t) => !traitIds.includes(t.id) || t.id === editingId)

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted uppercase tracking-widest">
          {t('inventory.traits.title')}
        </span>
        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              resetForm()
              setAdding(true)
            }}
            className="text-xs text-ink-faint hover:text-ink transition-colors"
          >
            + {t('inventory.traits.add')}
          </button>
        )}
      </div>

      {assigned.length > 0 && (
        <div className="space-y-2">
          {assigned.map((trait) => (
            <div key={trait.id}>
              <AssignedTrait
                trait={trait}
                value={resolveGearTraitValue(trait.id, traitValues)}
                scopeCategory={scopeCategory}
                editing={editingId === trait.id}
                onEdit={() => startEdit(trait)}
                onRemove={() => handleRemove(trait.id)}
              />
              {editingId === trait.id && (
                <div className="mt-2">
                  <TraitEditorPanel
                    mode="edit"
                    draft={draft}
                    catalog={pickerCatalog}
                    lookupCatalog={catalog}
                    scopeCategory={scopeCategory}
                    saving={saving}
                    error={error}
                    onNameChange={handleNameChange}
                    onDraftChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                    onSave={handleSaveEdit}
                    onCancel={resetForm}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {assigned.length === 0 && !formOpen && (
        <p className="text-xs text-ink-faint italic">{t('inventory.traits.empty')}</p>
      )}

      {adding && (
        <TraitEditorPanel
          mode="add"
          draft={draft}
          catalog={pickerCatalog}
          lookupCatalog={catalog}
          scopeCategory={scopeCategory}
          saving={saving}
          error={error}
          onNameChange={handleNameChange}
          onDraftChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          onSave={handleAdd}
          onCancel={resetForm}
        />
      )}
    </div>
  )
}
