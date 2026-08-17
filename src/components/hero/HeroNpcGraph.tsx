import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FaUser } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import GearIcon from '@/components/hero/GearIcon'
import Spinner from '@/components/ui/Spinner'
import type { CampaignNpc, Hero, HeroNpcNodePos, HeroNpcRelation } from '@/types'
import { heroFullName } from '@/types'
import { hasRenderableGearIcon } from '@/utils/gearIcons'
import {
  GRAPH_COLORS,
  HERO_NPC_NODE_ID,
  clampGraphCoord,
  graphColorForStance,
  layoutHeroNpcGraph,
  graphNpcIds,
} from '@/utils/heroNpcRelations'

interface Props {
  hero: Hero
  npcs: CampaignNpc[]
  relations: HeroNpcRelation[]
  extraNodeIds?: string[]
  savedPositions?: Record<string, HeroNpcNodePos>
  canEdit?: boolean
  selectedNodeId: string | null
  selectedRelationId: string | null
  onSelectNode: (nodeId: string | null) => void
  onSelectRelation: (relationId: string | null) => void
  onMoveNode?: (id: string, x: number, y: number) => void
  linking?: boolean
  linkFromId?: string | null
  onLinkPick?: (id: string) => void
  hint?: string
  saving?: boolean
  cornerActions?: ReactNode
  detailPanel?: ReactNode
}

const VB = 100
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5
const ZOOM_WHEEL_FACTOR = 1.12
const DRAG_THRESHOLD_PX = 5
const HERO_BOX_PX = 48
const NPC_BOX_PX = 40
const MARKER_LABEL_PX = 9
const MARKER_MAX_W_PX = 112

export default function HeroNpcGraph({
  hero,
  npcs,
  relations,
  extraNodeIds = [],
  savedPositions = {},
  canEdit = false,
  selectedNodeId,
  selectedRelationId,
  onSelectNode,
  onSelectRelation,
  onMoveNode,
  linking = false,
  linkFromId = null,
  onLinkPick,
  hint,
  saving = false,
  cornerActions,
  detailPanel,
}: Props) {
  const { t } = useTranslation()
  const byId = new Map(npcs.map((n) => [n.id, n]))
  const [livePositions, setLivePositions] = useState<Record<string, HeroNpcNodePos>>({})
  const stickyRef = useRef<Record<string, HeroNpcNodePos>>({})
  const npcIds = graphNpcIds(relations, extraNodeIds)
  const heroName = heroFullName(hero, '…')

  const posById = useMemo(() => {
    const laid = layoutHeroNpcGraph(relations, VB, extraNodeIds, {
      ...stickyRef.current,
      ...savedPositions,
      ...livePositions,
    })
    const rec: Record<string, { x: number; y: number }> = {}
    const nextSticky: Record<string, HeroNpcNodePos> = {}
    for (const [id, pos] of laid) {
      rec[id] = { x: pos.x, y: pos.y }
      nextSticky[id] = rec[id]
    }
    stickyRef.current = nextSticky
    return rec
  }, [relations, extraNodeIds, savedPositions, livePositions])

  const surfaceRef = useRef<HTMLDivElement>(null)
  const panDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const nodeDragRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    active: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
  viewRef.current = { zoom, pan }

  const heroBox = HERO_BOX_PX * zoom
  const npcBox = NPC_BOX_PX * zoom
  const markerLabel = MARKER_LABEL_PX * zoom
  const markerMaxW = MARKER_MAX_W_PX * zoom
  const labelPadX = 6 * zoom
  const labelPadY = 2 * zoom

  function clampPan(px: number, py: number, z: number, w: number, h: number) {
    if (z <= 1.001) return { x: 0, y: 0 }
    const minX = w * (1 - z)
    const minY = h * (1 - z)
    return {
      x: Math.min(0, Math.max(minX, px)),
      y: Math.min(0, Math.max(minY, py)),
    }
  }

  function clientToPct(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = surfaceRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const { zoom: z, pan: p } = viewRef.current
    return {
      x: clampGraphCoord(((clientX - rect.left - p.x) / (rect.width * z)) * 100),
      y: clampGraphCoord(((clientY - rect.top - p.y) / (rect.height * z)) * 100),
    }
  }

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const surface = el
    function onWheel(e: WheelEvent) {
      if ((e.target as Element).closest('[data-graph-overlay]')) return
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

  function handleSurfacePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return
    if (viewRef.current.zoom <= 1.001) return
    const target = e.target as Element
    if (target.closest('button')) return
    if (target.closest('line, path')) return
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

  function handleNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    if (!canEdit || linking || e.button !== 0) return
    const pos = posById[id]
    if (!pos) return
    nodeDragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: pos.x,
      lastY: pos.y,
      active: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleNodePointerMove(e: React.PointerEvent) {
    const drag = nodeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !canEdit) return
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
    drag.lastX = pct.x
    drag.lastY = pct.y
    setLivePositions((prev) => ({ ...prev, [drag.id]: pct }))
  }

  function handleNodePointerUp(e: React.PointerEvent) {
    const drag = nodeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    const moved = drag.active
    const id = drag.id
    const x = drag.lastX
    const y = drag.lastY
    nodeDragRef.current = null
    setDraggingId(null)
    if (!moved) return
    onMoveNode?.(id, x, y)
  }

  function selectNode(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (linking && canEdit) {
      onLinkPick?.(id)
      return
    }
    onSelectNode(selectedNodeId === id ? null : id)
    onSelectRelation(null)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomed = zoom > MIN_ZOOM + 0.001

  function renderNode(
    id: string,
    label: string,
    box: number,
    color: string,
    imageURL: string,
    selected: boolean,
    fallback: ReactNode,
    icon = '',
  ) {
    const pos = posById[id]
    if (!pos) return null
    const dragging = draggingId === id
    const linkFrom = linking && linkFromId === id
    return (
      <button
        key={id}
        type="button"
        data-graph-node=""
        onPointerDown={(e) => handleNodePointerDown(e, id)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        onPointerCancel={handleNodePointerUp}
        onClick={(e) => selectNode(e, id)}
        className={`
          absolute -translate-x-1/2 -translate-y-1/2 p-0 border-0 bg-transparent appearance-none
          ${linking
            ? 'cursor-crosshair'
            : canEdit
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-pointer'}
          ${dragging ? 'z-[20]' : 'z-[7]'}
        `}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: box,
          height: box,
        }}
        title={label}
      >
        <span
          className={`w-full h-full rounded-full border-2 overflow-hidden bg-void flex items-center justify-center shadow-md shadow-void/50 ${
            linkFrom ? 'ring-2 ring-blood-light/50 !border-blood-light' : ''
          }`}
          style={{
            borderColor: linkFrom ? undefined : color,
            boxShadow: selected && !linkFrom ? `0 0 0 3px ${color}55` : undefined,
          }}
        >
          {imageURL ? (
            <img src={imageURL} alt="" draggable={false} className="w-full h-full object-cover" />
          ) : hasRenderableGearIcon(icon) ? (
            <span className="w-1/2 h-1/2 flex items-center justify-center" style={{ color }}>
              <GearIcon value={icon} className="w-full h-full" />
            </span>
          ) : (
            fallback
          )}
        </span>
        <span
          className="absolute left-1/2 -translate-x-1/2 leading-tight text-center text-ink rounded bg-void/95 border border-border/60 shadow-sm shadow-void/60 line-clamp-2 pointer-events-none"
          style={{
            top: '100%',
            marginTop: 2 * zoom,
            maxWidth: markerMaxW,
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
  }

  return (
    <div className="space-y-2">
      <div
        ref={surfaceRef}
        className={`relative w-full aspect-square max-h-[min(60vh,28rem)] rounded-lg border overflow-hidden select-none touch-none ${
          linking ? 'border-blood-light/60' : 'border-border'
        } ${!linking && zoomed ? (panning ? 'cursor-grabbing' : 'cursor-grab') : linking ? 'cursor-crosshair' : ''}`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, #2a241c 0%, transparent 55%), linear-gradient(165deg, #161410 0%, #0e0c0a 100%)',
        }}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          onSelectNode(null)
          onSelectRelation(null)
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <svg
            className="absolute inset-0 w-full h-full z-[1]"
            viewBox={`0 0 ${VB} ${VB}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            {relations.map((relation) => {
              const from = posById[relation.fromId]
              const to = posById[relation.toId]
              if (!from || !to) return null
              const selected = selectedRelationId === relation.id
              const touchesSelected =
                selectedNodeId != null
                && (relation.fromId === selectedNodeId || relation.toId === selectedNodeId)
              const color = graphColorForStance(relation.stance)
              const active = selected || touchesSelected
              return (
                <g
                  key={relation.id}
                  data-graph-edge=""
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectRelation(selected ? null : relation.id)
                    onSelectNode(null)
                  }}
                >
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="transparent"
                    strokeWidth={10}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth={active ? 1.2 : 0.75}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    opacity={active ? 1 : 0.9}
                  />
                </g>
              )
            })}
          </svg>

          {relations.map((relation) => {
            const from = posById[relation.fromId]
            const to = posById[relation.toId]
            const label = relation.label.trim()
            if (!from || !to || !label) return null
            const selected = selectedRelationId === relation.id
            const color = graphColorForStance(relation.stance)
            return (
              <span
                key={`label-${relation.id}`}
                className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 leading-tight text-center rounded bg-void/95 border border-border/60 shadow-sm shadow-void/60 pointer-events-none line-clamp-1"
                style={{
                  left: `${(from.x + to.x) / 2}%`,
                  top: `${(from.y + to.y) / 2}%`,
                  maxWidth: markerMaxW,
                  fontSize: markerLabel,
                  paddingLeft: labelPadX,
                  paddingRight: labelPadX,
                  paddingTop: labelPadY,
                  paddingBottom: labelPadY,
                  color: selected ? '#e8dcc8' : color,
                }}
              >
                {label.length > 18 ? `${label.slice(0, 16)}…` : label}
              </span>
            )
          })}

          {renderNode(
            HERO_NPC_NODE_ID,
            heroName,
            heroBox,
            GRAPH_COLORS.hero,
            hero.imageURL,
            selectedNodeId === HERO_NPC_NODE_ID,
            <span className="text-lg" style={{ color: GRAPH_COLORS.hero }}>☠</span>,
          )}

          {npcIds.map((npcId) => {
            const npc = byId.get(npcId)
            if (!npc) return null
            const selected = selectedNodeId === npcId
            const edge = relations.find((r) => r.fromId === npcId || r.toId === npcId)
            const color = edge ? graphColorForStance(edge.stance) : GRAPH_COLORS.neutral
            const label = npc.name.trim() || '—'
            return renderNode(
              npcId,
              label,
              npcBox,
              color,
              npc.imageURL,
              selected,
              <FaUser className="w-1/2 h-1/2" style={{ color }} aria-hidden />,
              npc.icon ?? '',
            )
          })}
        </div>

        {detailPanel && (
          <div
            data-graph-overlay=""
            className="absolute top-2 left-2 z-30 w-[min(16rem,calc(100%-5.5rem))] max-h-[calc(100%-1rem)] overflow-visible"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {detailPanel}
          </div>
        )}
        {cornerActions && (
          <div
            data-graph-overlay=""
            className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1 w-[min(16rem,calc(100%-1rem))]"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {cornerActions}
          </div>
        )}
        {saving && (
          <div
            data-graph-overlay=""
            className="absolute bottom-2 left-2 z-30 pointer-events-none"
            aria-live="polite"
            aria-label={t('settlement.saving')}
          >
            <Spinner size="sm" />
          </div>
        )}
        {hint && (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest text-ink-faint/80 pointer-events-none z-20 max-w-[70%] text-center">
            {hint}
          </p>
        )}
        <button
          type="button"
          data-graph-overlay=""
          className="absolute bottom-2 right-2 z-30 px-1.5 py-0.5 rounded border border-border bg-void/90 text-[9px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink transition-colors disabled:opacity-40 disabled:hover:text-ink-faint"
          title={t('hero.npc.graphZoomReset')}
          aria-label={t('hero.npc.graphZoom')}
          disabled={!zoomed}
          onClick={(e) => {
            e.stopPropagation()
            resetView()
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint px-0.5">
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.hero }} />
          {t('hero.npc.legendHero')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.ally }} />
          {t('hero.npc.legendAlly')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.enemy }} />
          {t('hero.npc.legendEnemy')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.neutral }} />
          {t('hero.npc.legendNeutral')}
        </li>
      </ul>
    </div>
  )
}
