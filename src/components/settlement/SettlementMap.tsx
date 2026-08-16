import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaUser } from 'react-icons/fa'
import {
  constructionLocalizedName,
  getSettlementConstruction,
} from '@/config/settlementConstructions'
import { settlementConstructionIcon } from '@/config/settlementConstructionIcons'
import type { SettlementConnection, SettlementConstructionInstance, SettlementNpc } from '@/types'

const DRAG_THRESHOLD_PX = 5
const MAX_VISIBLE_NPCS = 3

export type SettlementLinkMode = 'off' | 'connect' | 'disconnect'

interface Props {
  constructions: SettlementConstructionInstance[]
  connections: SettlementConnection[]
  npcs?: SettlementNpc[]
  selectedId: string | null
  selectedConnectionId: string | null
  linkMode: SettlementLinkMode
  linkFromId: string | null
  canEdit: boolean
  onSelect: (id: string | null) => void
  onSelectConnection: (id: string | null) => void
  onLinkPick: (id: string) => void
  onRemoveConnection: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}

function NpcAvatar({ npc }: { npc: SettlementNpc }) {
  const title = [npc.name.trim(), npc.role.trim()].filter(Boolean).join(' · ') || undefined
  return (
    <span
      className="w-5 h-5 rounded-full border border-border-light overflow-hidden bg-void flex items-center justify-center shadow shadow-void/40"
      title={title}
    >
      {npc.imageURL ? (
        <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
      ) : (
        <FaUser className="w-2.5 h-2.5 text-ink-faint" aria-hidden />
      )}
    </span>
  )
}

export default function SettlementMap({
  constructions,
  connections,
  npcs = [],
  selectedId,
  selectedConnectionId,
  linkMode,
  linkFromId,
  canEdit,
  onSelect,
  onSelectConnection,
  onLinkPick,
  onRemoveConnection,
  onMove,
}: Props) {
  const { t, i18n } = useTranslation()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    active: boolean
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
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

  function clientToPct(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = surfaceRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    if (!canEdit || linking) return
    dragRef.current = {
      id,
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
    onMove(drag.id, pct.x, pct.y)
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
    onSelectConnection(null)
    onSelect(id)
  }

  function handleConnectionClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (linkMode === 'disconnect' && canEdit) {
      onRemoveConnection(id)
      return
    }
    if (linking) return
    onSelect(null)
    onSelectConnection(id)
  }

  function clearSelection() {
    onSelect(null)
    onSelectConnection(null)
  }

  const mapHint =
    linkMode === 'connect'
      ? t('settlement.connectModeHint')
      : linkMode === 'disconnect'
        ? t('settlement.disconnectModeHint')
        : t('settlement.mapLabel')

  return (
    <div
      ref={surfaceRef}
      className={`relative w-full aspect-square max-h-[min(70vh,36rem)] rounded-lg border overflow-hidden select-none touch-none ${
        linkMode === 'connect'
          ? 'border-blood-light/60'
          : linkMode === 'disconnect'
            ? 'border-blood/70'
            : 'border-border'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at 40% 30%, #3a3428 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, #2a2218 0%, transparent 50%), linear-gradient(165deg, #1a1814 0%, #12100e 50%, #0e0c0a 100%)',
      }}
      onClick={clearSelection}
    >
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #8a7a5a 1px, transparent 1px), linear-gradient(to bottom, #8a7a5a 1px, transparent 1px)',
          backgroundSize: '5% 5%',
        }}
      />
      <p className="absolute top-2 left-2 text-[10px] font-mono uppercase tracking-widest text-ink-faint/70 pointer-events-none z-20 max-w-[85%]">
        {mapHint}
      </p>

      {constructions.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint pointer-events-none px-4 text-center">
          {t('settlement.mapEmpty')}
        </p>
      )}

      <svg
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
                stroke={selected || linkMode === 'disconnect' ? '#c45c4a' : '#6b5d45'}
                strokeWidth={selected ? 1.2 : 0.7}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={interactive ? 'cursor-pointer' : 'pointer-events-none'}
                opacity={selected ? 1 : linkMode === 'disconnect' ? 0.95 : 0.85}
                onClick={(e) => handleConnectionClick(e, conn.id)}
              />
            </g>
          )
        })}
      </svg>

      {constructions.map((item) => {
        const def = getSettlementConstruction(item.catalogKey)
        const label = item.label.trim()
          || (def ? constructionLocalizedName(def, i18n.language) : item.catalogKey)
        const selected = selectedId === item.id
        const linkFrom = linkFromId === item.id
        const Icon = settlementConstructionIcon(item.catalogKey, def?.category)
        const assigned = npcsByConstruction.get(item.id) ?? []
        const visibleNpcs = assigned.slice(0, MAX_VISIBLE_NPCS)
        const extraNpcs = assigned.length - visibleNpcs.length
        return (
          <button
            key={item.id}
            type="button"
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => handleMarkerClick(e, item.id)}
            className={`
              absolute z-10 -translate-x-1/2 -translate-y-1/2
              flex flex-col items-center gap-0.5 max-w-[7rem]
              ${linking
                ? 'cursor-crosshair'
                : canEdit
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-pointer'}
              ${draggingId === item.id ? 'z-20' : ''}
            `}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            title={label}
          >
            {assigned.length > 0 && (
              <span className="flex items-center -space-x-1 mb-0.5 pointer-events-none">
                {visibleNpcs.map((npc) => (
                  <NpcAvatar key={npc.id} npc={npc} />
                ))}
                {extraNpcs > 0 && (
                  <span className="w-5 h-5 rounded-full border border-border bg-elevated text-[8px] font-mono text-ink-faint flex items-center justify-center">
                    +{extraNpcs}
                  </span>
                )}
              </span>
            )}
            <span
              className={`
                w-8 h-8 rounded-md border flex items-center justify-center
                shadow-md shadow-void/50
                ${linkFrom
                  ? 'bg-blood/40 border-blood-light text-ink ring-2 ring-blood-light/50'
                  : selected
                    ? 'bg-blood/30 border-blood-light text-ink'
                    : 'bg-elevated/95 border-border text-blood-light'}
              `}
            >
              <Icon className="w-4 h-4" aria-hidden />
            </span>
            <span className="text-[9px] leading-tight text-center text-ink px-1 py-0.5 rounded bg-void/80 line-clamp-2">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
