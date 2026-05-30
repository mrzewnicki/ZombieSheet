import { useEffect, useId, useRef, useState } from 'react'

export interface SearchableSelectOption {
  value: string
  label: string
  /** Shown as a separate badge on the right (e.g. stat value). */
  detail?: string | number
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  noneLabel: string
  noResultsLabel: string
  searchPlaceholder?: string
  className?: string
}

function optionText(opt: SearchableSelectOption): string {
  if (!opt.value) return opt.label
  return opt.detail != null ? `${opt.label} (${opt.detail})` : opt.label
}

function matchesQuery(opt: SearchableSelectOption, q: string): boolean {
  return `${opt.label} ${opt.detail ?? ''}`.toLowerCase().includes(q)
}

function OptionRow({
  opt,
  highlighted,
  selected,
  onSelect,
  onHover,
}: {
  opt: SearchableSelectOption
  highlighted: boolean
  selected: boolean
  onSelect: () => void
  onHover: () => void
}) {
  const isNone = !opt.value

  return (
    <li
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => {
        e.preventDefault()
        onSelect()
      }}
      onMouseEnter={onHover}
      className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer border-b border-border/50 last:border-b-0 transition-colors ${
        highlighted
          ? 'bg-elevated text-ink border-l-2 border-l-blood/70 pl-[calc(0.75rem-2px)]'
          : 'border-l-2 border-l-transparent text-ink-muted hover:bg-elevated/60 hover:text-ink'
      }`}
    >
      <span
        className={`min-w-0 text-sm leading-snug ${
          isNone ? 'text-ink-faint italic' : highlighted ? 'text-ink' : ''
        }`}
      >
        {opt.label}
      </span>
      {!isNone && opt.detail != null && (
        <span
          className={`shrink-0 min-w-[1.75rem] rounded border px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${
            highlighted
              ? 'border-blood/30 bg-void text-blood-light'
              : 'border-border bg-void/80 text-ink-muted'
          }`}
        >
          {opt.detail}
        </span>
      )}
    </li>
  )
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  noneLabel,
  noResultsLabel,
  searchPlaceholder,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedLabel = selected ? optionText(selected) : ''

  const noneOption: SearchableSelectOption = { value: '', label: noneLabel }
  const filtered = (() => {
    const q = query.trim().toLowerCase()
    const list = [noneOption, ...options]
    if (!q) return list
    return list.filter((o) => matchesQuery(o, q))
  })()

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
    setQuery(selectedLabel)
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
      e.stopPropagation()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (filtered[highlight]) select(filtered[highlight].value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-throw-combobox=""
      data-throw-combobox-open={open ? 'true' : undefined}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : selectedLabel}
        placeholder={open ? (searchPlaceholder ?? noneLabel) : noneLabel}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={openList}
        onKeyDown={onKeyDown}
        className="w-full bg-void border border-border rounded px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-blood/50"
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded border border-border bg-surface py-1 shadow-xl shadow-black/30"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-faint">{noResultsLabel}</li>
          ) : (
            filtered.map((opt, idx) => (
              <OptionRow
                key={opt.value || '__none__'}
                opt={opt}
                highlighted={idx === highlight}
                selected={value === opt.value}
                onSelect={() => select(opt.value)}
                onHover={() => setHighlight(idx)}
              />
            ))
          )}
        </ul>
      )}
    </div>
  )
}
