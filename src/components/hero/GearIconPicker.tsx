import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GearIcon from '@/components/hero/GearIcon'
import {
  gearIconLabel,
  getGearIconCatalogSize,
  loadGearIconCatalog,
  searchGearIcons,
} from '@/utils/gearIcons'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function GearIconPicker({ label, value, onChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [catalogReady, setCatalogReady] = useState(false)
  const [catalogSize, setCatalogSize] = useState(getGearIconCatalogSize())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const list = searchGearIcons(query)
    return [{ value: '', label: t('inventory.visual.iconNone'), set: 'gi' as const, keywords: '' }, ...list]
  }, [query, t, catalogReady])

  const selectedLabel = value ? gearIconLabel(value) : t('inventory.visual.iconNone')

  useEffect(() => {
    let active = true
    loadGearIconCatalog().then((catalog) => {
      if (!active) return
      setCatalogReady(true)
      setCatalogSize(catalog.length)
    })
    return () => {
      active = false
    }
  }, [])

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

  function select(optionValue: string) {
    onChange(optionValue)
    setOpen(false)
    setQuery('')
  }

  function openList() {
    setOpen(true)
    setQuery('')
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
      if (filtered[highlight]) select(filtered[highlight].value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  const totalCount = catalogSize

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 min-w-0">
      <label htmlFor={listId} className="text-xs text-ink-muted uppercase tracking-widest">
        {label}
      </label>

      <div className="flex rounded border border-border bg-surface overflow-hidden focus-within:border-blood focus-within:ring-1 focus-within:ring-blood/40 transition-colors">
        <div className="shrink-0 w-10 flex items-center justify-center border-r border-border bg-elevated text-lg text-ink">
          {value ? <GearIcon value={value} className="text-base" /> : null}
        </div>

        <input
          ref={inputRef}
          id={listId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          value={open ? query : selectedLabel}
          placeholder={open ? t('inventory.visual.iconSearchPlaceholder') : t('inventory.visual.iconPlaceholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={openList}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent border-0 px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 w-9 flex items-center justify-center border-l border-border text-ink-faint hover:text-ink hover:bg-elevated transition-colors"
            aria-label={t('inventory.visual.iconClear')}
            title={t('inventory.visual.iconClear')}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded border border-border bg-surface py-0.5 shadow-xl shadow-black/30"
        >
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-ink-faint">
              {catalogReady ? t('inventory.visual.iconNoResults') : t('common.loading')}
            </li>
          ) : (
            filtered.map((opt, idx) => {
              const isNone = !opt.value
              const setLabel = opt.set === 'ra' ? t('inventory.visual.iconSetRa') : t('inventory.visual.iconSetGi')

              return (
                <li
                  key={opt.value || '__none__'}
                  role="option"
                  aria-selected={value === opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(opt.value)
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`flex items-center gap-2 px-2 py-1 cursor-pointer border-b border-border/50 last:border-b-0 border-l-2 transition-colors ${
                    idx === highlight
                      ? 'bg-elevated text-ink border-l-blood/70'
                      : 'border-l-transparent text-ink-muted hover:bg-elevated/60 hover:text-ink'
                  }`}
                >
                  <span className="shrink-0 w-9 h-9 flex items-center justify-center rounded border border-border bg-void text-xl leading-none">
                    {isNone ? null : <GearIcon value={opt.value} className="text-xl" />}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm leading-snug ${isNone ? 'italic text-ink-faint' : ''}`}>
                    {opt.label}
                  </span>
                  {!isNone && (
                    <span className="shrink-0 rounded border border-border bg-void/80 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {setLabel}
                    </span>
                  )}
                </li>
              )
            })
          )}
          {!query.trim() && (
            <li className="px-2 py-1 text-[10px] text-ink-faint border-t border-border/50">
              {t('inventory.visual.iconCatalogHint', { count: totalCount })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
