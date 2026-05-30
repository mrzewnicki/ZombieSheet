import { useEffect, useId, useRef, useState } from 'react'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  noneLabel: string
  noResultsLabel: string
  className?: string
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  noneLabel,
  noResultsLabel,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selectedLabel = value ? (options.find((o) => o.value === value)?.label ?? '') : ''

  const noneOption: SearchableSelectOption = { value: '', label: noneLabel }
  const filtered = (() => {
    const q = query.trim().toLowerCase()
    const list = [noneOption, ...options]
    if (!q) return list
    return list.filter((o) => o.label.toLowerCase().includes(q))
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
        placeholder={noneLabel}
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
          className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-1.5 text-sm text-ink-faint">{noResultsLabel}</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value || '__none__'}
                role="option"
                aria-selected={value === opt.value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(opt.value)
                }}
                className={`px-2.5 py-1.5 text-sm cursor-pointer ${
                  idx === highlight ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated/50'
                }`}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
