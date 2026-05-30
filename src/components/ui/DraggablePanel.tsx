import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  badge?: string
  /** Changing this resets panel position when reopened */
  resetKey?: string
  children: ReactNode
}

function centerPanel(el: HTMLElement) {
  const { offsetWidth: w, offsetHeight: h } = el
  return {
    x: Math.max(8, (window.innerWidth - w) / 2),
    y: Math.max(8, (window.innerHeight - h) / 2),
  }
}

export default function DraggablePanel({ open, title, badge, resetKey, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)

  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return
    const apply = () => setPos(centerPanel(el))
    apply()
    requestAnimationFrame(apply)
  }, [open, resetKey])

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

  function onDragStart(e: React.MouseEvent) {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-80 bg-surface border border-blood/50 rounded-lg shadow-xl shadow-blood/10"
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
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
