import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaSearchMinus, FaSearchPlus, FaUser } from 'react-icons/fa'
import GearIcon from '@/components/hero/GearIcon'
import {
  constructionLocalizedName,
  resolveSettlementConstruction,
} from '@/config/settlementConstructions'
import { settlementConstructionIcon } from '@/config/settlementConstructionIcons'
import type {
  SettlementConnection,
  SettlementConstructionInstance,
  SettlementCustomConstruction,
  SettlementMapObjectInstance,
  SettlementNpc,
} from '@/types'
import {
  settlementConnectionDashArray,
  settlementConnectionStroke,
} from '@/utils/settlementConnections'
import {
  getSettlementMapObject,
  mapObjectLocalizedName,
} from '@/config/settlementMapObjects'
import { settlementMapObjectIcon } from '@/config/settlementMapObjectIcons'

const DRAG_THRESHOLD_PX = 5
const MAX_VISIBLE_NPCS = 3
const ARROW_PULLBACK = 2.6
const ARROW_SIZE = 1.35
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5
const ZOOM_BUTTON_STEP = 0.35
const ZOOM_WHEEL_FACTOR = 1.12
const MARKER_BOX_PX = 32
const MARKER_ICON_PX = 16
const OBJECT_BOX_PX = 40
const OBJECT_ICON_PX = 22
const MARKER_LABEL_PX = 9
const MARKER_MAX_W_PX = 112
const NPC_AVATAR_PX = 20

function connectionArrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  toward: 'to' | 'from',
): string {
  const tipX = toward === 'to' ? x2 : x1
  const tipY = toward === 'to' ? y2 : y1
  const baseX = toward === 'to' ? x1 : x2
  const baseY = toward === 'to' ? y1 : y2
  const dx = tipX - baseX
  const dy = tipY - baseY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const ax = tipX - ux * ARROW_PULLBACK
  const ay = tipY - uy * ARROW_PULLBACK
  const bx = ax - ux * ARROW_SIZE
  const by = ay - uy * ARROW_SIZE
  const px = -uy * ARROW_SIZE * 0.7
  const py = ux * ARROW_SIZE * 0.7
  return `${ax},${ay} ${bx + px},${by + py} ${bx - px},${by - py}`
}

export type SettlementLinkMode = 'off' | 'connect' | 'disconnect'

interface Props {
  constructions: SettlementConstructionInstance[]
  objects?: SettlementMapObjectInstance[]
  customConstructions?: SettlementCustomConstruction[]
  connections: SettlementConnection[]
  npcs?: SettlementNpc[]
  settlementName?: string
  selectedId: string | null
  selectedObjectId?: string | null
  selectedConnectionId: string | null
  linkMode: SettlementLinkMode
  linkFromId: string | null
  canEdit: boolean
  onSelect: (id: string | null) => void
  onSelectObject?: (id: string | null) => void
  onSelectConnection: (id: string | null) => void
  onLinkPick: (id: string) => void
  onRemoveConnection: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onMoveObject?: (id: string, x: number, y: number) => void
}

function NpcAvatar({ npc, size }: { npc: SettlementNpc; size: number }) {
  const title = [npc.name.trim(), npc.role.trim()].filter(Boolean).join(' · ') || undefined
  const iconSize = Math.max(8, size * 0.5)
  return (
    <span
      className="rounded-full border border-border-light overflow-hidden bg-void flex items-center justify-center shadow shadow-void/40 shrink-0"
      style={{ width: size, height: size }}
      title={title}
    >
      {npc.imageURL ? (
        <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
      ) : (
        <FaUser className="text-ink-faint" style={{ width: iconSize, height: iconSize }} aria-hidden />
      )}
    </span>
  )
}

export default function SettlementMap({
  constructions,
  objects = [],
  customConstructions = [],
  connections,
  npcs = [],
  settlementName = '',
  selectedId,
  selectedObjectId = null,
  selectedConnectionId,
  linkMode,
  linkFromId,
  canEdit,
  onSelect,
  onSelectObject,
  onSelectConnection,
  onLinkPick,
  onRemoveConnection,
  onMove,
  onMoveObject,
}: Props) {
  const { t, i18n } = useTranslation()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    id: string
    kind: 'construction' | 'object'
    pointerId: number
    startX: number
    startY: number
    active: boolean
  } | null>(null)
  const panDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
  viewRef.current = { zoom, pan }
  const suppressClickRef = useRef(false)

  const byId = new Map(constructions.map((c) => [c.id, c]))
  const linking = linkMode !== 'off'

  const npcsByConstruction = new Map<string, SettlementNpc[]>()
  for (const npc of npcs) {
    if (!npc.constructionId) continue
    const list = npcsByConstruction.get(npc.constructionId) ?? []
    list.push(npc)
    npcsByConstruction.set(npc.constructionId, list)
  }

  function clampPan(px: number, py: number, z: number, w: number, h: number) {
    if (z <= 1.001) return { x: 0, y: 0 }
    const minX = w * (1 - z)
    const minY = h * (1 - z)
    return {
      x: Math.min(0, Math.max(minX, px)),
      y: Math.min(0, Math.max(minY, py)),
    }
  }

  function setView(nextZoom: number, nextPan: { x: number; y: number }, w: number, h: number) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    if (z <= 1.001) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }
    setZoom(z)
    setPan(clampPan(nextPan.x, nextPan.y, z, w, h))
  }

  function zoomAt(nextZoom: number, focusClientX?: number, focusClientY?: number) {
    const el = surfaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const { zoom: z0, pan: p0 } = viewRef.current
    const mx = focusClientX != null ? focusClientX - rect.left : rect.width / 2
    const my = focusClientY != null ? focusClientY - rect.top : rect.height / 2
    const contentX = (mx - p0.x) / z0
    const contentY = (my - p0.y) / z0
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    setView(z, { x: mx - contentX * z, y: my - contentY * z }, rect.width, rect.height)
  }

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const surface = el
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = surface.getBoundingClientRect()
      const { zoom: z0, pan: p0 } = viewRef.current
      const factor = e.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z0 * factor))
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const contentX = (mx - p0.x) / z0
      const contentY = (my - p0.y) / z0
      if (z <= 1.001) {
        setZoom(1)
        setPan({ x: 0, y: 0 })
        return
      }
      setZoom(z)
      setPan(clampPan(mx - contentX * z, my - contentY * z, z, rect.width, rect.height))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function clientToPct(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = surfaceRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const { zoom: z, pan: p } = viewRef.current
    const x = ((clientX - rect.left - p.x) / (rect.width * z)) * 100
    const y = ((clientY - rect.top - p.y) / (rect.height * z)) * 100
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }
  }

  function handlePointerDown(
    e: React.PointerEvent,
    id: string,
    kind: 'construction' | 'object' = 'construction',
  ) {
    e.stopPropagation()
    if (!canEdit || linking) return
    dragRef.current = {
      id,
      kind,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !canEdit || linking) return

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      drag.active = true
      suppressClickRef.current = true
      setDraggingId(drag.id)
    }

    const pct = clientToPct(e.clientX, e.clientY)
    if (!pct) return
    if (drag.kind === 'object') onMoveObject?.(drag.id, pct.x, pct.y)
    else onMove(drag.id, pct.x, pct.y)
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current
    if (drag && drag.pointerId === e.pointerId) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    dragRef.current = null
    setDraggingId(null)
  }

  function handleSurfacePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return
    if (viewRef.current.zoom <= 1.001) return
    const target = e.target as Element
    if (target.closest('button')) return
    if (target.closest('line, polygon')) return
    e.preventDefault()
    panDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: viewRef.current.pan.x,
      originY: viewRef.current.pan.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setPanning(true)
  }

  function handleSurfacePointerMove(e: React.PointerEvent) {
    const drag = panDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const el = surfaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) suppressClickRef.current = true
    setPan(
      clampPan(
        drag.originX + dx,
        drag.originY + dy,
        viewRef.current.zoom,
        rect.width,
        rect.height,
      ),
    )
  }

  function handleSurfacePointerUp(e: React.PointerEvent) {
    const drag = panDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    panDragRef.current = null
    setPanning(false)
  }

  function handleMarkerClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (linking && canEdit) {
      onLinkPick(id)
      return
    }
    onSelectObject?.(null)
    onSelectConnection(null)
    onSelect(id)
  }

  function handleObjectClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (linking) return
    onSelect(null)
    onSelectConnection(null)
    onSelectObject?.(id)
  }

  function handleConnectionClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (linkMode === 'disconnect' && canEdit) {
      onRemoveConnection(id)
      return
    }
    if (linking) return
    onSelect(null)
    onSelectObject?.(null)
    onSelectConnection(id)
  }

  function clearSelection() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onSelect(null)
    onSelectObject?.(null)
    onSelectConnection(null)
  }

  const named = settlementName.trim()
  const mapHint =
    linkMode === 'connect'
      ? t('settlement.connectModeHint')
      : linkMode === 'disconnect'
        ? t('settlement.disconnectModeHint')
        : named
          ? t('settlement.mapLabelNamed', { name: named })
          : t('settlement.mapLabel')

  const markerBox = MARKER_BOX_PX * zoom
  const markerIcon = MARKER_ICON_PX * zoom
  const objectBox = OBJECT_BOX_PX * zoom
  const objectIcon = OBJECT_ICON_PX * zoom
  const markerLabel = MARKER_LABEL_PX * zoom
  const markerMaxW = MARKER_MAX_W_PX * zoom
  const npcAvatar = NPC_AVATAR_PX * zoom
  const labelPadX = 6 * zoom
  const labelPadY = 2 * zoom

  return (
    <div
      ref={surfaceRef}
      className={`relative w-full aspect-square max-h-[min(70vh,36rem)] rounded-lg border overflow-hidden select-none touch-none ${
        linkMode === 'connect'
          ? 'border-blood-light/60'
          : linkMode === 'disconnect'
            ? 'border-blood/70'
            : 'border-border'
      } ${panning ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : ''}`}
      style={{
        background:
          'radial-gradient(ellipse at 40% 30%, #1c1814 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, #161210 0%, transparent 45%), linear-gradient(165deg, #100e0c 0%, #0c0a08 55%, #080706 100%)',
      }}
      onPointerDown={handleSurfacePointerDown}
      onPointerMove={handleSurfacePointerMove}
      onPointerUp={handleSurfacePointerUp}
      onPointerCancel={handleSurfacePointerUp}
      onClick={clearSelection}
    >
      <div className="absolute top-2 right-2 z-30 flex items-center gap-1">
        <button
          type="button"
          className="w-8 h-8 rounded border border-border bg-void/85 text-ink-muted hover:text-ink hover:border-ink-muted flex items-center justify-center transition-colors disabled:opacity-40"
          title={t('settlement.mapZoomIn')}
          aria-label={t('settlement.mapZoomIn')}
          onClick={(e) => {
            e.stopPropagation()
            zoomAt(viewRef.current.zoom + ZOOM_BUTTON_STEP)
          }}
          disabled={zoom >= MAX_ZOOM - 0.001}
        >
          <FaSearchPlus className="w-3.5 h-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded border border-border bg-void/85 text-ink-muted hover:text-ink hover:border-ink-muted flex items-center justify-center transition-colors disabled:opacity-40"
          title={t('settlement.mapZoomOut')}
          aria-label={t('settlement.mapZoomOut')}
          onClick={(e) => {
            e.stopPropagation()
            zoomAt(viewRef.current.zoom - ZOOM_BUTTON_STEP)
          }}
          disabled={zoom <= MIN_ZOOM}
        >
          <FaSearchMinus className="w-3.5 h-3.5" aria-hidden />
        </button>
        {zoom > 1.001 && (
          <button
            type="button"
            className="h-8 px-2 rounded border border-border bg-void/85 text-[10px] font-mono uppercase tracking-wider text-ink-muted hover:text-ink hover:border-ink-muted transition-colors"
            title={t('settlement.mapZoomReset')}
            aria-label={t('settlement.mapZoomReset')}
            onClick={(e) => {
              e.stopPropagation()
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
      </div>

      <p className="absolute top-2 left-2 text-[10px] font-mono uppercase tracking-widest text-ink-faint/70 pointer-events-none z-20 max-w-[55%]">
        {mapHint}
      </p>

      <div
        data-map-world="1"
        className="absolute left-0 top-0"
        style={{
          width: `${zoom * 100}%`,
          height: `${zoom * 100}%`,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
        onClick={clearSelection}
      >
        <div
          data-map-world="1"
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #6a5a42 1px, transparent 1px), linear-gradient(to bottom, #6a5a42 1px, transparent 1px)',
            backgroundSize: '5% 5%',
          }}
        />

        {constructions.length === 0 && objects.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint pointer-events-none px-4 text-center">
            {t('settlement.mapEmpty')}
          </p>
        )}

        <svg
          data-map-world="1"
          className="absolute inset-0 w-full h-full z-[1]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {connections.map((conn) => {
            const from = byId.get(conn.fromId)
            const to = byId.get(conn.toId)
            if (!from || !to) return null
            const selected = selectedConnectionId === conn.id
            const interactive = !linking || linkMode === 'disconnect'
            const stroke =
              linkMode === 'disconnect'
                ? '#c45c4a'
                : settlementConnectionStroke(conn.color)
            const dash = settlementConnectionDashArray(conn.lineStyle)
            const end = conn.endSymbol ?? 'none'
            const showTo = end === 'arrowTo' || end === 'arrowBoth'
            const showFrom = end === 'arrowFrom' || end === 'arrowBoth'
            return (
              <g key={conn.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={10}
                  vectorEffect="non-scaling-stroke"
                  className={interactive ? 'cursor-pointer' : 'pointer-events-none'}
                  onClick={(e) => handleConnectionClick(e, conn.id)}
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={stroke}
                  strokeWidth={selected ? 1.2 : 0.75}
                  strokeLinecap={conn.lineStyle === 'dotted' ? 'round' : 'butt'}
                  strokeDasharray={dash}
                  vectorEffect="non-scaling-stroke"
                  className={interactive ? 'cursor-pointer' : 'pointer-events-none'}
                  opacity={selected ? 1 : linkMode === 'disconnect' ? 0.95 : 0.9}
                  onClick={(e) => handleConnectionClick(e, conn.id)}
                />
                {showTo && (
                  <polygon
                    points={connectionArrowPoints(from.x, from.y, to.x, to.y, 'to')}
                    fill={stroke}
                    opacity={selected ? 1 : 0.95}
                    className={interactive ? 'cursor-pointer' : 'pointer-events-none'}
                    onClick={(e) => handleConnectionClick(e, conn.id)}
                  />
                )}
                {showFrom && (
                  <polygon
                    points={connectionArrowPoints(from.x, from.y, to.x, to.y, 'from')}
                    fill={stroke}
                    opacity={selected ? 1 : 0.95}
                    className={interactive ? 'cursor-pointer' : 'pointer-events-none'}
                    onClick={(e) => handleConnectionClick(e, conn.id)}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {constructions.map((item) => {
          const def = resolveSettlementConstruction(item.catalogKey, customConstructions)
          const label = item.label.trim()
            || (def ? constructionLocalizedName(def, i18n.language) : item.catalogKey)
          const selected = selectedId === item.id
          const linkFrom = linkFromId === item.id
          const FallbackIcon = settlementConstructionIcon(item.catalogKey, def?.category)
          const assigned = npcsByConstruction.get(item.id) ?? []
          const visibleNpcs = assigned.slice(0, MAX_VISIBLE_NPCS)
          const extraNpcs = assigned.length - visibleNpcs.length
          return (
            <button
              key={item.id}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, item.id, 'construction')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(e) => handleMarkerClick(e, item.id)}
              className={`
                absolute z-10 -translate-x-1/2 -translate-y-1/2
                flex flex-col items-center
                ${linking
                  ? 'cursor-crosshair'
                  : canEdit
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'}
                ${draggingId === item.id ? 'z-20' : ''}
              `}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                maxWidth: markerMaxW,
                gap: 2 * zoom,
              }}
              title={label}
            >
              {assigned.length > 0 && (
                <span
                  className="flex items-center pointer-events-none"
                  style={{ marginBottom: 2 * zoom, marginLeft: npcAvatar * 0.25, marginRight: npcAvatar * 0.25 }}
                >
                  {visibleNpcs.map((npc, i) => (
                    <span
                      key={npc.id}
                      style={{ marginLeft: i === 0 ? 0 : -npcAvatar * 0.35 }}
                    >
                      <NpcAvatar npc={npc} size={npcAvatar} />
                    </span>
                  ))}
                  {extraNpcs > 0 && (
                    <span
                      className="rounded-full border border-border bg-elevated font-mono text-ink-faint flex items-center justify-center"
                      style={{
                        width: npcAvatar,
                        height: npcAvatar,
                        marginLeft: -npcAvatar * 0.35,
                        fontSize: Math.max(7, 8 * zoom),
                      }}
                    >
                      +{extraNpcs}
                    </span>
                  )}
                </span>
              )}
              <span
                className={`
                  rounded-md border flex items-center justify-center
                  shadow-md shadow-void/50
                  ${linkFrom
                    ? 'ring-2 ring-blood-light/50 border-blood-light'
                    : selected
                      ? 'ring-2 ring-blood-light/40 border-blood-light'
                      : 'border-border'}
                `}
                style={{
                  width: markerBox,
                  height: markerBox,
                  backgroundColor: item.bgColor?.trim() || '#231c16',
                  color: item.iconColor?.trim() || '#b02020',
                }}
              >
                {def?.icon ? (
                  <span
                    className="inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>i]:leading-none"
                    style={{ width: markerIcon, height: markerIcon, fontSize: markerIcon }}
                  >
                    <GearIcon value={def.icon} className="w-full h-full" />
                  </span>
                ) : (
                  <FallbackIcon style={{ width: markerIcon, height: markerIcon }} aria-hidden />
                )}
              </span>
              <span
                className="leading-tight text-center text-ink rounded bg-void/95 border border-border/60 shadow-sm shadow-void/60 line-clamp-2"
                style={{
                  fontSize: markerLabel,
                  paddingLeft: labelPadX,
                  paddingRight: labelPadX,
                  paddingTop: labelPadY,
                  paddingBottom: labelPadY,
                }}
              >
                {label}
              </span>
            </button>
          )
        })}

        {objects.map((item) => {
          const def = getSettlementMapObject(item.catalogKey)
          const label = item.label.trim()
            || (def ? mapObjectLocalizedName(def, i18n.language) : item.catalogKey)
          const selected = selectedObjectId === item.id
          const Icon = settlementMapObjectIcon(item.catalogKey)
          return (
            <button
              key={item.id}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, item.id, 'object')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(e) => handleObjectClick(e, item.id)}
              className={`
                absolute z-10 -translate-x-1/2 -translate-y-1/2
                flex flex-col items-center
                ${linking
                  ? 'pointer-events-none opacity-60'
                  : canEdit
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'}
                ${draggingId === item.id ? 'z-20' : ''}
              `}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                maxWidth: markerMaxW,
                gap: 2 * zoom,
              }}
              title={label}
              tabIndex={linking ? -1 : undefined}
            >
              <span
                className={`
                  rounded-full border flex items-center justify-center
                  shadow-md shadow-void/50
                  ${selected
                    ? 'ring-2 ring-blood-light/40 border-blood-light'
                    : 'border-border'}
                `}
                style={{
                  width: objectBox,
                  height: objectBox,
                  backgroundColor: item.bgColor?.trim() || def?.defaultBgColor || '#1c1b19',
                  color: item.iconColor?.trim() || def?.defaultIconColor || '#9a958c',
                }}
              >
                <Icon style={{ width: objectIcon, height: objectIcon }} aria-hidden />
              </span>
              <span
                className="leading-tight text-center text-ink rounded bg-void/95 border border-border/60 shadow-sm shadow-void/60 line-clamp-2"
                style={{
                  fontSize: markerLabel,
                  paddingLeft: labelPadX,
                  paddingRight: labelPadX,
                  paddingTop: labelPadY,
                  paddingBottom: labelPadY,
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
