import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { formatDurationMs } from '@/utils/musicPlayback'

export default function MusicWaveformSeek({
  peaks,
  positionMs,
  durationMs,
  onSeek,
  loading,
  ariaLabel = 'Seek',
}: {
  peaks?: number[]
  positionMs: number
  durationMs: number
  onSeek: (positionMs: number) => void
  loading?: boolean
  ariaLabel?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [scrubMs, setScrubMs] = useState<number | null>(null)

  useEffect(() => {
    if (dragging.current) return
    setScrubMs(null)
  }, [positionMs])

  const empty = !(durationMs > 0)
  const displayMs = scrubMs ?? positionMs
  const progress = !empty ? Math.min(1, Math.max(0, displayMs / durationMs)) : 0
  const bars = peaks && peaks.length >= 2 ? peaks : null
  const n = bars?.length ?? 0

  function positionFromClientX(clientX: number): number {
    const el = trackRef.current
    if (!el || durationMs <= 0) return 0
    const rect = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(t * durationMs)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (empty) return
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrubMs(positionFromClientX(e.clientX))
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (empty || !dragging.current) return
    setScrubMs(positionFromClientX(e.clientX))
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    dragging.current = false
    const next = positionFromClientX(e.clientX)
    setScrubMs(null)
    onSeek(next)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (empty) return
    const step = Math.max(1000, Math.round(durationMs / 50))
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onSeek(Math.min(durationMs, positionMs + step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onSeek(Math.max(0, positionMs - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSeek(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onSeek(durationMs)
    }
  }

  return (
    <div className="block space-y-1">
      <span className="text-[10px] font-mono text-ink-faint">
        {empty ? '0:00 / —' : `${formatDurationMs(displayMs)} / ${formatDurationMs(durationMs)}`}
        {loading && !bars ? ' · …' : ''}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={empty ? -1 : 0}
        aria-disabled={empty}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, durationMs)}
        aria-valuenow={empty ? 0 : Math.min(displayMs, durationMs)}
        aria-label={ariaLabel}
        className={`relative h-16 w-full rounded border border-border bg-dark/60 touch-none select-none overflow-hidden ${
          empty ? 'cursor-default opacity-60' : 'cursor-pointer'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {bars ? (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${n} 40`}
            preserveAspectRatio="none"
            aria-hidden
          >
            {bars.map((peak, i) => {
              const h = Math.max(1.5, peak * 18)
              const filled = (i + 0.5) / n <= progress
              return (
                <rect
                  key={i}
                  x={i + 0.15}
                  y={20 - h}
                  width={0.7}
                  height={h * 2}
                  fill={filled ? '#9a1f1f' : '#6b7280'}
                  opacity={filled ? 1 : 0.55}
                />
              )
            })}
          </svg>
        ) : !empty ? (
          <div
            className="absolute inset-y-0 left-0 bg-blood/35 pointer-events-none"
            style={{ width: `${progress * 100}%` }}
          />
        ) : null}
        {!empty && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-10"
            style={{ left: `calc(${progress * 100}% - 1px)` }}
          />
        )}
      </div>
    </div>
  )
}
