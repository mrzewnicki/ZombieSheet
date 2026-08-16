import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export type DraggablePanelAnchor = { x: number; y: number }

interface Props {
  open: boolean
  title: string
  badge?: string
  /** Changing this resets panel position when reopened */
  resetKey?: string
  /** Client (viewport) coordinates to pin the panel to. Falls back to viewport center. */
  anchor?: DraggablePanelAnchor | null
  onClose?: () => void
  children: ReactNode
}

const MARGIN = 8
const HEADER_ESTIMATE = 42

function centerPanel(el: HTMLElement) {
  const { offsetWidth: w, offsetHeight: h } = el
  return {
    x: Math.max(MARGIN, (window.innerWidth - w) / 2),
    y: Math.max(MARGIN, (window.innerHeight - h) / 2),
  }
}

/** Pin top-left to the cursor; shrink height instead of shifting away. */
function pinToAnchor(el: HTMLElement, anchor: DraggablePanelAnchor) {
  const w = el.offsetWidth
  let x = anchor.x
  const y = Math.max(MARGIN, Math.min(anchor.y, window.innerHeight - HEADER_ESTIMATE - MARGIN))

  if (x + w > window.innerWidth - MARGIN) {
    x = window.innerWidth - w - MARGIN
  }
  x = Math.max(MARGIN, x)

  const bodyMax = Math.max(120, window.innerHeight - y - HEADER_ESTIMATE - MARGIN)
  return { x, y, bodyMax }
}

export default function DraggablePanel({
  open,
  title,
  badge,
  resetKey,
  anchor,
  onClose,
  children,
}: Props) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [bodyMaxH, setBodyMaxH] = useState<number | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)

  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return
    const apply = () => {
      if (anchor) {
        const next = pinToAnchor(el, anchor)
        setPos({ x: next.x, y: next.y })
        setBodyMaxH(next.bodyMax)
      } else {
        setPos(centerPanel(el))
        setBodyMaxH(null)
      }
    }
    apply()
    requestAnimationFrame(apply)
  }, [open, resetKey, anchor])

  useEffect(() => {
    if (!open) return
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }
    function onUp() {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [open])

  useEffect(() => {
    if (!open || !onClose) return
    const close = onClose
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const target = e.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  function onDragStart(e: React.MouseEvent) {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className="fixed z-50 w-80 max-w-[calc(100vw-1rem)] bg-surface border border-blood/50 rounded-lg shadow-xl shadow-blood/10"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none bg-elevated rounded-t-lg"
        onMouseDown={onDragStart}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-ink-faint shrink-0">
          <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
        </svg>
        <h3 className="font-heading text-sm text-ink tracking-wide flex-1 truncate">{title}</h3>
        {badge && (
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint border border-border rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
        {onClose && (
          <button
            type="button"
            className="shrink-0 text-ink-faint hover:text-ink text-xs font-mono uppercase tracking-wider px-1"
            aria-label={t('common.close')}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="p-4 overflow-y-auto"
        style={{
          maxHeight: bodyMaxH != null
            ? Math.min(bodyMaxH, Math.min(window.innerHeight * 0.7, 36 * 16))
            : 'min(70vh, 36rem)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
