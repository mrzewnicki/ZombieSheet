import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearVisualFields } from '@/types'
import { gearColorStripeStyle } from '@/utils/gearVisual'
import GearItemVisual from '@/components/hero/GearItemVisual'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

const COLLAPSE_MS = 300
const CLAMP_CLASS = 'line-clamp-1 [&_*]:inline [&_p]:inline'

function measureDescriptionHeights(el: HTMLElement) {
  if (el.offsetWidth <= 0) return null

  const saved = el.className
  const classes = CLAMP_CLASS.split(' ')
  const wrapper = el.parentElement
  const savedMax = wrapper?.style.maxHeight ?? ''
  if (wrapper) wrapper.style.maxHeight = 'none'

  el.classList.remove(...classes)
  const full = el.scrollHeight

  el.className = saved
  el.classList.add(...classes)
  const collapsed = el.getBoundingClientRect().height

  el.className = saved
  if (wrapper) wrapper.style.maxHeight = savedMax

  return { full, collapsed, overflows: full > collapsed + 1 }
}

interface Props {
  visual: GearVisualFields
  name: string
  description?: string
  chips: React.ReactNode
  readOnly?: boolean
  onEdit?: () => void
  onDelete?: () => void
  editLabel: string
  deleteLabel: string
  sortHandle?: React.ReactNode
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .146.354l2 2a.5.5 0 0 1 .11.168l2 5a.5.5 0 0 1-.65.65l-5-2a.5.5 0 0 1-.168-.11l-2-2A.5.5 0 0 1 9 13.5v-.5h-.5a.5.5 0 0 1-.5-.5v-.5h-.5a.5.5 0 0 1-.5-.5v-.5h-.292l5.647-5.646z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M6 2h4a1 1 0 0 0-2 0H6a1 1 0 0 0-2 0H2v1h12V2h-2a1 1 0 0 0-2 0zM3 5l1 9h8l1-9H3zm3 1h1v7H6V6zm3 0h1v7H9V6z" />
    </svg>
  )
}

export default function GearListRow({
  visual,
  name,
  description,
  chips,
  readOnly = false,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  sortHandle,
}: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [maxHeight, setMaxHeight] = useState<number | 'none'>('none')
  const [isOverflowing, setIsOverflowing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const collapsingRef = useRef(false)
  const stripe = gearColorStripeStyle(visual.color)
  const hasDescription = Boolean(description?.trim())
  const canExpand = hasDescription && isOverflowing
  const align = hasDescription ? 'items-start' : 'items-center'
  const showClamp = hasDescription && !expanded && !animating

  const measure = useCallback(() => {
    const el = contentRef.current
    if (!el) return null
    return measureDescriptionHeights(el)
  }, [])

  const syncOverflow = useCallback((resetExpanded = false) => {
    const heights = measure()
    if (!heights) return false

    setIsOverflowing(heights.overflows)
    if (resetExpanded) {
      setExpanded(false)
      setAnimating(false)
      setMaxHeight('none')
    }
    return true
  }, [measure])

  useLayoutEffect(() => {
    if (!hasDescription) {
      setIsOverflowing(false)
      return
    }

    if (syncOverflow(true)) return

    const el = contentRef.current
    if (!el) return

    const raf = requestAnimationFrame(() => syncOverflow(true))
    const ro = new ResizeObserver(() => syncOverflow(false))
    ro.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [description, hasDescription, syncOverflow])

  function toggleExpanded() {
    const el = contentRef.current
    const heights = measure()
    if (!el || !heights?.overflows) return

    if (expanded) {
      collapsingRef.current = true
      setAnimating(true)
      setMaxHeight(el.getBoundingClientRect().height)
      requestAnimationFrame(() => {
        setMaxHeight(heights.collapsed)
      })
    } else {
      collapsingRef.current = false
      setAnimating(true)
      setMaxHeight(heights.collapsed)
      setExpanded(true)
      requestAnimationFrame(() => {
        setMaxHeight(heights.full)
      })
    }
  }

  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'max-height') return

    setAnimating(false)
    setMaxHeight('none')

    if (collapsingRef.current) {
      collapsingRef.current = false
      setExpanded(false)
    }
  }

  function stopBubble(e: React.MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div
      className={`group flex ${align} gap-3 bg-surface border border-border rounded-lg px-4 py-2.5${stripe ? ' border-l-4' : ''}${canExpand ? ' cursor-pointer hover:bg-elevated/30 transition-colors' : ''}`}
      style={stripe}
      onClick={toggleExpanded}
      onKeyDown={(e) => {
        if (!canExpand) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleExpanded()
        }
      }}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      aria-expanded={canExpand ? expanded : undefined}
      aria-label={
        canExpand
          ? expanded
            ? t('inventory.list.collapseItem', { name })
            : t('inventory.list.expandItem', { name })
          : undefined
      }
    >
      <div onClick={stopBubble} className="shrink-0">
        <GearItemVisual
          imageUrl={visual.imageUrl}
          icon={visual.icon}
          color={visual.color}
          label={name}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-h-[1.25rem]">
          <span className="text-ink text-sm font-medium truncate">{name}</span>
          {chips}
        </div>
        {hasDescription && (
          <div
            className="mt-1 overflow-hidden transition-[max-height] ease-in-out"
            style={{
              maxHeight: maxHeight === 'none' ? undefined : `${maxHeight}px`,
              transitionDuration: `${COLLAPSE_MS}ms`,
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            <div
              ref={contentRef}
              className={`prose-hero text-xs text-ink-faint [&_p]:mb-1 [&_p:last-child]:mb-0 [&_p]:leading-snug ${
                showClamp ? CLAMP_CLASS : ''
              }`}
            >
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {description}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {!readOnly && (
        <div
          className="flex gap-0.5 shrink-0 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
          onClick={stopBubble}
        >
          {sortHandle}
          <button
            type="button"
            onClick={onEdit}
            title={editLabel}
            aria-label={editLabel}
            className="w-7 h-7 flex items-center justify-center text-ink-faint hover:text-ink rounded hover:bg-elevated transition-colors"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={deleteLabel}
            aria-label={deleteLabel}
            className="w-7 h-7 flex items-center justify-center text-ink-faint hover:text-blood rounded hover:bg-elevated transition-colors"
          >
            <DeleteIcon />
          </button>
        </div>
      )}
    </div>
  )
}
