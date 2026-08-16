import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaUser } from 'react-icons/fa'
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  constructionLocalizedDescription,
  constructionLocalizedName,
  resolveSettlementConstruction,
} from '@/config/settlementConstructions'
import { SETTLEMENT_MATERIALS, type SettlementMaterialKey } from '@/config/settlementMaterials'
import ConstructionPicker from '@/components/settlement/ConstructionPicker'
import MapObjectPicker from '@/components/settlement/MapObjectPicker'
import SettlementBuildTransactionBar from '@/components/settlement/SettlementBuildTransactionBar'
import SettlementMap, { type SettlementLinkMode } from '@/components/settlement/SettlementMap'
import SettlementMaterialsPanel from '@/components/settlement/SettlementMaterialsPanel'
import SettlementNpcsPanel from '@/components/settlement/SettlementNpcsPanel'
import SettlementTraitsPanel from '@/components/settlement/SettlementTraitsPanel'
import {
  getSettlementMapObject,
  mapObjectLocalizedDescription,
  mapObjectLocalizedName,
} from '@/config/settlementMapObjects'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import RichTextEditor from '@/components/ui/RichTextEditor'
import Spinner from '@/components/ui/Spinner'
import SaveIcon from '@/components/icons/SaveIcon'
import GearIconPicker from '@/components/hero/GearIconPicker'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutContext } from '@/contexts/LayoutContext'
import { useCampaignNpcs } from '@/hooks/useCampaignNpcs'
import { useGameRole } from '@/hooks/useGameRole'
import {
  connectionExists,
  fillMissingMstConnections,
  newSettlementConnection,
  pruneSettlementConnections,
  removeConnectionBetween,
  removeConnectionsForConstruction,
  SETTLEMENT_CONNECTION_COLORS,
  SETTLEMENT_CONNECTION_END_SYMBOLS,
  SETTLEMENT_CONNECTION_LINE_STYLES,
  SETTLEMENT_MARKER_COLORS,
  settlementConnectionStroke,
  settlementMarkerBgColor,
  settlementMarkerIconColor,
  DEFAULT_SETTLEMENT_CONNECTION_COLOR,
  DEFAULT_SETTLEMENT_MARKER_BG_COLOR,
  DEFAULT_SETTLEMENT_MARKER_ICON_COLOR,
} from '@/utils/settlementConnections'
import type {
  Game,
  Settlement,
  SettlementConnection,
  SettlementConnectionEndSymbol,
  SettlementConnectionLineStyle,
  SettlementConstructionInstance,
  SettlementMapObjectInstance,
  SettlementZone,
  SettlementZonePoint,
} from '@/types'
import {
  SETTLEMENT_COLLECTION,
  SETTLEMENT_DOC_ID,
  newConstructionInstance,
  newCustomConstruction,
  newMapObjectInstance,
  normalizeSettlement,
  pruneSettlementNpcs,
  settlementPayload,
} from '@/utils/settlement'
import {
  applyBuildTxnChange,
  applyMaterialDelta,
  summarizeBuildTxnCost,
  type BuildTxnEntry,
} from '@/utils/settlementBuildTransaction'
import {
  DEFAULT_SETTLEMENT_ZONE_COLOR,
  DEFAULT_SETTLEMENT_ZONE_ICON_COLOR,
  isNearZonePoint,
  newSettlementZone,
  SETTLEMENT_ZONE_COLORS,
} from '@/utils/settlementZones'
import {
  constructionMapLayer,
  objectMapLayer,
  zoneMapLayer,
  type SettlementMapLayer,
} from '@/utils/settlementMapLayers'
import { gearTraitPolarityClasses } from '@/utils/gearTraits'
import TraitValueBadge from '@/components/ui/TraitValueBadge'
import {
  parseSettlementProperties,
  settlementPropertyDisplayValue,
  settlementPropertyLabel,
} from '@/utils/settlementProperties'

function connectionLinePreviewDash(style: SettlementConnectionLineStyle): string | undefined {
  switch (style) {
    case 'dashed':
      return '7 5'
    case 'dotted':
      return '1.8 4'
    case 'dashDot':
      return '7 3.5 1.8 3.5'
    default:
      return undefined
  }
}

function ConnectionLineStylePreview({ style }: { style: SettlementConnectionLineStyle }) {
  return (
    <svg width="44" height="14" viewBox="0 0 44 14" aria-hidden className="block">
      <line
        x1="3"
        y1="7"
        x2="41"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap={style === 'dotted' ? 'round' : 'butt'}
        strokeDasharray={connectionLinePreviewDash(style)}
      />
    </svg>
  )
}

function ConnectionEndSymbolPreview({ symbol }: { symbol: SettlementConnectionEndSymbol }) {
  if (symbol === 'none') {
    return (
      <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden className="block">
        <line x1="3" y1="5" x2="21" y2="5" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    )
  }
  if (symbol === 'arrowTo') {
    return (
      <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden className="block">
        <line x1="2" y1="5" x2="16.5" y2="5" stroke="currentColor" strokeWidth="1.25" />
        <polygon points="21.5,5 16.2,2.6 16.2,7.4" fill="currentColor" />
      </svg>
    )
  }
  if (symbol === 'arrowFrom') {
    return (
      <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden className="block">
        <line x1="7.5" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="1.25" />
        <polygon points="2.5,5 7.8,2.6 7.8,7.4" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden className="block">
      <line x1="8" y1="5" x2="20" y2="5" stroke="currentColor" strokeWidth="1.25" />
      <polygon points="2.5,5 7.8,2.6 7.8,7.4" fill="currentColor" />
      <polygon points="25.5,5 20.2,2.6 20.2,7.4" fill="currentColor" />
    </svg>
  )
}

export default function SettlementPage({
  gameId: gameIdProp,
  embedded = false,
}: {
  gameId?: string
  embedded?: boolean
} = {}) {
  const { gameId: gameIdParam = '' } = useParams()
  const gameId = gameIdProp || gameIdParam
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const layout = useContext(LayoutContext)
  const { role, loading: roleLoading } = useGameRole(gameId)
  const canEdit = role === 'gm' || role === 'player'
  const { npcs: campaignNpcs } = useCampaignNpcs(gameId)

  const [game, setGame] = useState<Game | null>(null)
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState<SettlementLinkMode>('off')
  const [linkFromId, setLinkFromId] = useState<string | null>(null)
  const [zoneDrawMode, setZoneDrawMode] = useState(false)
  const [zoneDraftPoints, setZoneDraftPoints] = useState<SettlementZonePoint[]>([])
  const [activeLayer, setActiveLayer] = useState<SettlementMapLayer>('objects')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [objectPickerOpen, setObjectPickerOpen] = useState(false)
  const [buildTxn, setBuildTxn] = useState<BuildTxnEntry[] | null>(null)
  const [activeTab, setActiveTab] = useState<'osada' | 'npc'>('osada')
  const [editDesc, setEditDesc] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const creatingRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settlementRef = useRef<Settlement | null>(null)

  useLayoutEffect(() => {
    if (embedded) return
    layout?.setHeader({
      backTo: `/game/${gameId}`,
      backLabel: game?.title ?? t('dashboard.title'),
      title: settlement?.name?.trim() || t('settlement.title'),
    })
    // Intentionally omit `layout` — context value is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, game?.title, gameId, settlement?.name, t])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
    })
    return unsub
  }, [gameId])

  useEffect(() => {
    creatingRef.current = false
    setLoading(true)
    setError(null)
    const ref = doc(db, 'games', gameId, SETTLEMENT_COLLECTION, SETTLEMENT_DOC_ID)
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        if (!creatingRef.current && canEdit && user) {
          creatingRef.current = true
          try {
            const empty = normalizeSettlement(SETTLEMENT_DOC_ID, null)
            await setDoc(ref, {
              ...settlementPayload(empty, user.uid),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            })
          } catch {
            setError(t('settlement.saveError'))
            creatingRef.current = false
            setLoading(false)
          }
        } else if (!canEdit) {
          setSettlement(normalizeSettlement(SETTLEMENT_DOC_ID, null))
          setLoading(false)
        }
        return
      }
      const next = normalizeSettlement(snap.id, snap.data() as Record<string, unknown>)
      settlementRef.current = next
      setSettlement(next)
      setLoading(false)
    }, () => {
      setError(t('settlement.loadError'))
      setLoading(false)
    })
    return unsub
  }, [gameId, canEdit, user, t])

  const persist = useCallback(async (next: Settlement) => {
    if (!user || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      await setDoc(
        doc(db, 'games', gameId, SETTLEMENT_COLLECTION, SETTLEMENT_DOC_ID),
        {
          ...settlementPayload(next, user.uid),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setError(t('settlement.saveError'))
    } finally {
      setSaving(false)
    }
  }, [canEdit, gameId, t, user])

  const scheduleSave = useCallback((next: Settlement) => {
    settlementRef.current = next
    setSettlement(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(next)
    }, 400)
  }, [persist])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  function patch(partial: Partial<Settlement>) {
    if (!settlement || !canEdit) return
    scheduleSave({ ...settlement, ...partial })
  }

  function setMaterial(key: SettlementMaterialKey, value: number) {
    if (!settlement) return
    patch({
      materials: { ...settlement.materials, [key]: Math.max(0, value) },
    })
  }

  function moveConstruction(id: string, x: number, y: number) {
    if (!settlement) return
    patch({
      constructions: settlement.constructions.map((c) =>
        c.id === id ? { ...c, x, y } : c,
      ),
    })
  }

  function moveObject(id: string, x: number, y: number) {
    if (!settlement) return
    patch({
      objects: settlement.objects.map((o) =>
        o.id === id ? { ...o, x, y } : o,
      ),
    })
  }

  function updateSelected(patchItem: Partial<SettlementConstructionInstance>) {
    if (!settlement || !selectedId) return
    patch({
      constructions: settlement.constructions.map((c) => {
        if (c.id !== selectedId) return c
        const next = { ...c, ...patchItem }
        if ('iconColor' in patchItem && !patchItem.iconColor) delete next.iconColor
        if ('bgColor' in patchItem && !patchItem.bgColor) delete next.bgColor
        return next
      }),
    })
  }

  function updateSelectedObject(patchItem: Partial<SettlementMapObjectInstance>) {
    if (!settlement || !selectedObjectId) return
    patch({
      objects: settlement.objects.map((o) => {
        if (o.id !== selectedObjectId) return o
        const next = { ...o, ...patchItem }
        if ('iconColor' in patchItem && !patchItem.iconColor) delete next.iconColor
        if ('bgColor' in patchItem && !patchItem.bgColor) delete next.bgColor
        return next
      }),
    })
  }

  function removeSelected() {
    if (!settlement || !selectedId) return
    const removed = settlement.constructions.find((c) => c.id === selectedId)
    const constructions = settlement.constructions.filter((c) => c.id !== selectedId)
    patch({
      constructions,
      connections: pruneSettlementConnections(settlement.connections, constructions),
      npcs: pruneSettlementNpcs(settlement.npcs, constructions),
    })
    if (removed && buildTxn) {
      const next = applyBuildTxnChange(buildTxn, removed.id, removed.catalogKey, 'remove')
      setBuildTxn(next.length === 0 ? null : next)
    }
    setSelectedId(null)
  }

  function removeSelectedObject() {
    if (!settlement || !selectedObjectId) return
    patch({
      objects: settlement.objects.filter((o) => o.id !== selectedObjectId),
    })
    setSelectedObjectId(null)
  }

  function trackBuildAdd(instanceId: string, catalogKey: string) {
    setBuildTxn((prev) => applyBuildTxnChange(prev ?? [], instanceId, catalogKey, 'add'))
  }

  function addConstruction(catalogKey: string) {
    if (!settlement) return
    const instance = newConstructionInstance(catalogKey, 40 + Math.random() * 20, 40 + Math.random() * 20)
    patch({ constructions: [...settlement.constructions, instance] })
    trackBuildAdd(instance.id, catalogKey)
    setSelectedId(instance.id)
    setSelectedObjectId(null)
    setSelectedZoneId(null)
    setSelectedConnectionId(null)
    setPickerOpen(false)
  }

  function createCustomConstruction(input: {
    name: string
    description: string
    category: string
    complexity: number
    time: number
    icon: string
  }) {
    if (!settlement) return
    const entry = newCustomConstruction(input)
    const instance = newConstructionInstance(entry.id, 40 + Math.random() * 20, 40 + Math.random() * 20)
    patch({
      customConstructions: [...settlement.customConstructions, entry],
      constructions: [...settlement.constructions, instance],
    })
    trackBuildAdd(instance.id, entry.id)
    setSelectedId(instance.id)
    setSelectedObjectId(null)
    setSelectedZoneId(null)
    setSelectedConnectionId(null)
    setPickerOpen(false)
  }

  function confirmBuildTxn() {
    if (!settlement || !buildTxn) return
    const delta = summarizeBuildTxnCost(buildTxn, settlement.customConstructions)
    patch({ materials: applyMaterialDelta(settlement.materials, delta) })
    setBuildTxn(null)
  }

  function freeBuildTxn() {
    setBuildTxn(null)
  }

  function updateSelectedCustomConstruction(patchItem: Partial<{ icon: string; name: string; description: string }>) {
    if (!settlement || !selectedId) return
    const instance = settlement.constructions.find((c) => c.id === selectedId)
    if (!instance) return
    const customId = instance.catalogKey
    if (!settlement.customConstructions.some((c) => c.id === customId)) return
    patch({
      customConstructions: settlement.customConstructions.map((c) => {
        if (c.id !== customId) return c
        const next = { ...c, ...patchItem }
        if ('icon' in patchItem && !patchItem.icon?.trim()) delete next.icon
        return next
      }),
    })
  }

  function addObject(catalogKey: string) {
    if (!settlement) return
    const instance = newMapObjectInstance(catalogKey, 30 + Math.random() * 40, 30 + Math.random() * 40)
    patch({ objects: [...settlement.objects, instance] })
    setSelectedObjectId(instance.id)
    setSelectedId(null)
    setSelectedZoneId(null)
    setSelectedConnectionId(null)
    setObjectPickerOpen(false)
  }

  function startZoneDraw() {
    setZoneDrawMode(true)
    setZoneDraftPoints([])
    setLinkMode('off')
    setLinkFromId(null)
    setSelectedId(null)
    setSelectedObjectId(null)
    setSelectedZoneId(null)
    setSelectedConnectionId(null)
  }

  function cancelZoneDraw() {
    setZoneDrawMode(false)
    setZoneDraftPoints([])
  }

  function finishZoneDraw(points: SettlementZonePoint[]) {
    if (!settlement || points.length < 3) return
    const zone = newSettlementZone(points, { layer: activeLayer })
    patch({ zones: [...settlement.zones, zone] })
    setZoneDrawMode(false)
    setZoneDraftPoints([])
    setSelectedZoneId(zone.id)
    setSelectedId(null)
    setSelectedObjectId(null)
    setSelectedConnectionId(null)
  }

  function handleActiveLayerChange(layer: SettlementMapLayer) {
    setActiveLayer(layer)
    if (!settlement) return
    if (selectedId) {
      const c = settlement.constructions.find((x) => x.id === selectedId)
      if (!c || constructionMapLayer(c.layer) !== layer) setSelectedId(null)
    }
    if (selectedObjectId) {
      const o = settlement.objects.find((x) => x.id === selectedObjectId)
      if (!o || objectMapLayer(o.layer) !== layer) setSelectedObjectId(null)
    }
    if (selectedZoneId) {
      const z = settlement.zones.find((x) => x.id === selectedZoneId)
      if (!z || zoneMapLayer(z.layer) !== layer) setSelectedZoneId(null)
    }
    if (layer !== 'objects') {
      setSelectedConnectionId(null)
      if (linkMode !== 'off') {
        setLinkMode('off')
        setLinkFromId(null)
      }
    }
  }

  function moveToLayer(
    target: { kind: 'construction' | 'object' | 'zone'; id: string },
    layer: SettlementMapLayer,
  ) {
    if (!settlement) return
    if (target.kind === 'construction') {
      patch({
        constructions: settlement.constructions.map((c) =>
          c.id === target.id ? { ...c, layer } : c,
        ),
      })
      if (selectedId === target.id && layer !== activeLayer) setSelectedId(null)
      return
    }
    if (target.kind === 'object') {
      patch({
        objects: settlement.objects.map((o) =>
          o.id === target.id ? { ...o, layer } : o,
        ),
      })
      if (selectedObjectId === target.id && layer !== activeLayer) setSelectedObjectId(null)
      return
    }
    patch({
      zones: settlement.zones.map((z) =>
        z.id === target.id ? { ...z, layer } : z,
      ),
    })
    if (selectedZoneId === target.id && layer !== activeLayer) setSelectedZoneId(null)
  }

  function handleZoneDraftClick(point: SettlementZonePoint) {
    if (!zoneDrawMode) return
    if (zoneDraftPoints.length >= 3 && isNearZonePoint(point, zoneDraftPoints[0])) {
      finishZoneDraw(zoneDraftPoints)
      return
    }
    setZoneDraftPoints((prev) => [...prev, point])
  }

  function moveZone(id: string, points: SettlementZonePoint[]) {
    if (!settlement) return
    patch({
      zones: settlement.zones.map((z) => (z.id === id ? { ...z, points } : z)),
    })
  }

  function updateSelectedZone(patchItem: Partial<SettlementZone>) {
    if (!settlement || !selectedZoneId) return
    patch({
      zones: settlement.zones.map((z) => {
        if (z.id !== selectedZoneId) return z
        const next = { ...z, ...patchItem }
        if ('icon' in patchItem && !patchItem.icon?.trim()) delete next.icon
        if ('iconColor' in patchItem && !patchItem.iconColor) delete next.iconColor
        return next
      }),
    })
  }

  function removeSelectedZone() {
    if (!settlement || !selectedZoneId) return
    patch({ zones: settlement.zones.filter((z) => z.id !== selectedZoneId) })
    setSelectedZoneId(null)
  }

  function setMapLinkMode(mode: SettlementLinkMode) {
    setLinkMode((prev) => (prev === mode ? 'off' : mode))
    setLinkFromId(null)
    setSelectedConnectionId(null)
    cancelZoneDraw()
  }

  function handleLinkPick(id: string) {
    if (!settlement || !canEdit || linkMode === 'off') return
    if (!linkFromId) {
      setLinkFromId(id)
      setSelectedId(id)
      setSelectedObjectId(null)
      return
    }
    if (linkFromId === id) {
      setLinkFromId(null)
      return
    }
    if (linkMode === 'connect') {
      if (!connectionExists(settlement.connections, linkFromId, id)) {
        patch({
          connections: [...settlement.connections, newSettlementConnection(linkFromId, id)],
        })
      }
    } else {
      patch({
        connections: removeConnectionBetween(settlement.connections, linkFromId, id),
      })
    }
    setLinkFromId(null)
    setSelectedId(id)
  }

  function generateConnections() {
    if (!settlement || !canEdit) return
    patch({
      connections: fillMissingMstConnections(settlement.connections, settlement.constructions),
    })
    setSelectedConnectionId(null)
  }

  function removeConnectionById(connectionId: string) {
    if (!settlement || !canEdit) return
    patch({
      connections: settlement.connections.filter((c) => c.id !== connectionId),
    })
    if (selectedConnectionId === connectionId) setSelectedConnectionId(null)
  }

  function removeSelectedConnection() {
    if (!selectedConnectionId) return
    removeConnectionById(selectedConnectionId)
  }

  function patchSelectedConnection(partial: Partial<SettlementConnection>) {
    if (!settlement || !canEdit || !selectedConnectionId) return
    patch({
      connections: settlement.connections.map((c) => {
        if (c.id !== selectedConnectionId) return c
        const next: SettlementConnection = { ...c, ...partial }
        if ('color' in partial && !partial.color) delete next.color
        if ('lineStyle' in partial && !partial.lineStyle) delete next.lineStyle
        if ('endSymbol' in partial && !partial.endSymbol) delete next.endSymbol
        return next
      }),
    })
  }

  function setSelectedConnectionColor(color: string) {
    patchSelectedConnection({
      color: color === DEFAULT_SETTLEMENT_CONNECTION_COLOR ? undefined : color,
    })
  }

  function removeLinksOfSelected() {
    if (!settlement || !canEdit || !selectedId) return
    patch({
      connections: removeConnectionsForConstruction(settlement.connections, selectedId),
    })
    setSelectedConnectionId(null)
  }

  useEffect(() => {
    if (!canEdit) return

    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return target.isContentEditable
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (pickerOpen || objectPickerOpen || isEditableTarget(e.target)) return

      if (selectedConnectionId) {
        if (!settlement) return
        e.preventDefault()
        patch({
          connections: settlement.connections.filter((c) => c.id !== selectedConnectionId),
        })
        setSelectedConnectionId(null)
        return
      }

      if (selectedZoneId && settlement) {
        e.preventDefault()
        patch({ zones: settlement.zones.filter((z) => z.id !== selectedZoneId) })
        setSelectedZoneId(null)
        return
      }

      if (selectedObjectId && settlement) {
        e.preventDefault()
        patch({
          objects: settlement.objects.filter((o) => o.id !== selectedObjectId),
        })
        setSelectedObjectId(null)
        return
      }

      if (selectedId && settlement) {
        e.preventDefault()
        const removed = settlement.constructions.find((c) => c.id === selectedId)
        const constructions = settlement.constructions.filter((c) => c.id !== selectedId)
        patch({
          constructions,
          connections: pruneSettlementConnections(settlement.connections, constructions),
          npcs: pruneSettlementNpcs(settlement.npcs, constructions),
        })
        if (removed && buildTxn) {
          const next = applyBuildTxnChange(buildTxn, removed.id, removed.catalogKey, 'remove')
          setBuildTxn(next.length === 0 ? null : next)
        }
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [buildTxn, canEdit, objectPickerOpen, patch, pickerOpen, selectedConnectionId, selectedId, selectedObjectId, selectedZoneId, settlement])

  function selectConstruction(id: string | null) {
    setSelectedId(id)
    if (id) {
      setSelectedObjectId(null)
      setSelectedZoneId(null)
      setSelectedConnectionId(null)
    }
  }

  function selectObject(id: string | null) {
    setSelectedObjectId(id)
    if (id) {
      setSelectedId(null)
      setSelectedZoneId(null)
      setSelectedConnectionId(null)
    }
  }

  function selectZone(id: string | null) {
    setSelectedZoneId(id)
    if (id) {
      setSelectedId(null)
      setSelectedObjectId(null)
      setSelectedConnectionId(null)
    }
  }

  function selectConnection(id: string | null) {
    setSelectedConnectionId(id)
    if (id) {
      setSelectedId(null)
      setSelectedObjectId(null)
      setSelectedZoneId(null)
    }
  }

  const selected = settlement?.constructions.find((c) => c.id === selectedId) ?? null
  const selectedObject = settlement?.objects.find((o) => o.id === selectedObjectId) ?? null
  const selectedZone = settlement?.zones.find((z) => z.id === selectedZoneId) ?? null
  const selectedObjectDef = selectedObject ? getSettlementMapObject(selectedObject.catalogKey) : undefined
  const selectedDef = selected
    ? resolveSettlementConstruction(selected.catalogKey, settlement?.customConstructions)
    : undefined
  const selectedCustom = selected && settlement
    ? settlement.customConstructions.find((c) => c.id === selected.catalogKey) ?? null
    : null
  const selectedConnection = settlement?.connections.find((c) => c.id === selectedConnectionId) ?? null
  const connectionFrom = selectedConnection
    ? settlement?.constructions.find((c) => c.id === selectedConnection.fromId)
    : null
  const connectionTo = selectedConnection
    ? settlement?.constructions.find((c) => c.id === selectedConnection.toId)
    : null
  const selectedLinks = selected && settlement
    ? settlement.connections
      .filter((c) => c.fromId === selected.id || c.toId === selected.id)
      .map((c) => {
        const otherId = c.fromId === selected.id ? c.toId : c.fromId
        const other = settlement.constructions.find((x) => x.id === otherId) ?? null
        return { connection: c, other }
      })
    : []
  const selectedNpcs = selected && settlement
    ? settlement.npcs.filter((n) => n.constructionId === selected.id)
    : []

  function constructionLabel(item: SettlementConstructionInstance | null | undefined): string {
    if (!item) return '—'
    const def = resolveSettlementConstruction(item.catalogKey, settlement?.customConstructions)
    return item.label.trim()
      || (def ? constructionLocalizedName(def, i18n.language) : item.catalogKey)
  }

  if (loading || roleLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!settlement) {
    return <p className="text-sm text-ink-faint text-center py-8">{t('settlement.loadError')}</p>
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {canEdit ? (
            <Input
              value={settlement.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('settlement.namePlaceholder')}
              className="font-heading text-lg"
            />
          ) : (
            <h2 className="font-heading text-lg text-blood-light tracking-wide">
              {settlement.name.trim() || t('settlement.title')}
            </h2>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-ink-muted uppercase tracking-widest">
                {t('settlement.descriptionLabel')}
              </p>
              {canEdit && !editDesc && (
                <button
                  type="button"
                  onClick={() => {
                    setDescriptionDraft(settlement.description)
                    setEditDesc(true)
                  }}
                  className="text-xs text-ink-faint hover:text-ink"
                >
                  {t('common.edit')}
                </button>
              )}
            </div>

            {editDesc ? (
              <div className="space-y-3">
                <RichTextEditor
                  value={descriptionDraft}
                  onChange={setDescriptionDraft}
                  placeholder={t('settlement.descriptionPlaceholder')}
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      patch({ description: descriptionDraft })
                      setEditDesc(false)
                    }}
                    icon={<SaveIcon />}
                  >
                    {t('common.save')}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditDesc(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg px-4 py-3 min-h-[80px]">
                {settlement.description ? (
                  <div className="prose-hero text-sm">
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      remarkPlugins={[remarkGfm]}
                    >
                      {settlement.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-ink-faint text-sm italic">—</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          {saving && <p className="text-[10px] font-mono text-ink-faint">{t('settlement.saving')}</p>}
          {error && <p className="text-xs text-blood max-w-[12rem]">{error}</p>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'osada' as const, label: t('settlement.tabOsada') },
          { id: 'npc' as const, label: t('settlement.tabNpc') },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-mono uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blood-light text-blood-light'
                : 'border-transparent text-ink-faint hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'npc' ? (
        <SettlementNpcsPanel
          gameId={gameId}
          npcs={settlement.npcs}
          campaignNpcs={campaignNpcs}
          constructions={settlement.constructions}
          customConstructions={settlement.customConstructions}
          canEdit={canEdit}
          onChange={(npcs) => patch({ npcs })}
        />
      ) : (
        <>
      <SettlementMaterialsPanel
        materials={settlement.materials}
        canEdit={canEdit}
        onChange={setMaterial}
      />

      <SettlementTraitsPanel
          gameId={gameId}
          traits={settlement.traits}
          canEdit={canEdit}
          onChange={(traits) => patch({ traits })}
        />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] gap-4 items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
              {t('settlement.mapSection')}
            </h3>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={linkMode === 'connect' ? 'primary' : 'outline'}
                  className="text-xs"
                  onClick={() => setMapLinkMode('connect')}
                  disabled={settlement.constructions.length < 2}
                >
                  {t('settlement.linkMode')}
                </Button>
                <Button
                  variant={linkMode === 'disconnect' ? 'danger' : 'outline'}
                  className="text-xs"
                  onClick={() => setMapLinkMode('disconnect')}
                  disabled={settlement.connections.length === 0}
                >
                  {t('settlement.disconnectMode')}
                </Button>
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={generateConnections}
                  disabled={settlement.constructions.length < 2}
                  title={t('settlement.generateConnectionsHint')}
                >
                  {t('settlement.generateConnections')}
                </Button>
                <Button variant="outline" className="text-xs" onClick={() => setPickerOpen(true)}>
                  {t('settlement.addConstruction')}
                </Button>
                <Button variant="outline" className="text-xs" onClick={() => setObjectPickerOpen(true)}>
                  {t('settlement.addObject')}
                </Button>
                {zoneDrawMode ? (
                  <>
                    <Button
                      variant="primary"
                      className="text-xs"
                      disabled={zoneDraftPoints.length < 3}
                      onClick={() => finishZoneDraw(zoneDraftPoints)}
                    >
                      {t('settlement.zoneFinish')}
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={cancelZoneDraw}>
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="text-xs" onClick={startZoneDraw}>
                    {t('settlement.addZone')}
                  </Button>
                )}
              </div>
            )}
          </div>
          <SettlementMap
            constructions={settlement.constructions}
            objects={settlement.objects}
            zones={settlement.zones}
            customConstructions={settlement.customConstructions}
            connections={settlement.connections}
            npcs={settlement.npcs}
            settlementName={settlement.name}
            selectedId={selectedId}
            selectedObjectId={selectedObjectId}
            selectedZoneId={selectedZoneId}
            selectedConnectionId={selectedConnectionId}
            linkMode={linkMode}
            linkFromId={linkFromId}
            zoneDrawMode={zoneDrawMode}
            zoneDraftPoints={zoneDraftPoints}
            activeLayer={activeLayer}
            canEdit={canEdit}
            onSelect={selectConstruction}
            onSelectObject={selectObject}
            onSelectZone={selectZone}
            onSelectConnection={selectConnection}
            onLinkPick={handleLinkPick}
            onRemoveConnection={removeConnectionById}
            onMove={moveConstruction}
            onMoveObject={moveObject}
            onMoveZone={moveZone}
            onZoneDraftClick={handleZoneDraftClick}
            onActiveLayerChange={handleActiveLayerChange}
            onMoveToLayer={moveToLayer}
          />
          {buildTxn && canEdit && (
            <SettlementBuildTransactionBar
              delta={summarizeBuildTxnCost(buildTxn, settlement.customConstructions)}
              materials={settlement.materials}
              addedCount={buildTxn.filter((e) => e.delta === 1).length}
              removedCount={buildTxn.filter((e) => e.delta === -1).length}
              onConfirm={confirmBuildTxn}
              onFree={freeBuildTxn}
            />
          )}
        </div>

        <div className="space-y-3 min-w-0">
        <aside className="rounded-lg border border-border bg-surface/60 p-3 space-y-3 min-h-[12rem]">
          {selectedConnection ? (
            <>
              <p className="text-sm text-ink font-medium">{t('settlement.connectionTitle')}</p>
              <p className="text-xs text-ink-muted">
                {constructionLabel(connectionFrom)}
                {selectedConnection.endSymbol === 'arrowTo'
                  ? ' → '
                  : selectedConnection.endSymbol === 'arrowFrom'
                    ? ' ← '
                    : selectedConnection.endSymbol === 'arrowBoth'
                      ? ' ↔ '
                      : ' — '}
                {constructionLabel(connectionTo)}
              </p>
              {canEdit && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('settlement.connectionColor')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SETTLEMENT_CONNECTION_COLORS.map((hex) => {
                      const active =
                        settlementConnectionStroke(selectedConnection.color) === hex
                      return (
                        <button
                          key={hex}
                          type="button"
                          title={hex}
                          onClick={() => setSelectedConnectionColor(hex)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            active
                              ? 'border-ink scale-110'
                              : 'border-border hover:border-ink-muted'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={t('settlement.connectionColorOption', { color: hex })}
                          aria-pressed={active}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
              {canEdit && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('settlement.connectionLineStyle')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {SETTLEMENT_CONNECTION_LINE_STYLES.map((style) => {
                      const active = (selectedConnection.lineStyle ?? 'solid') === style
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() =>
                            patchSelectedConnection({
                              lineStyle: style === 'solid' ? undefined : style,
                            })
                          }
                          className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded border transition-colors ${
                            active
                              ? 'border-blood-light text-blood-light bg-blood/10'
                              : 'border-border text-ink-faint hover:text-ink'
                          }`}
                          title={t(`settlement.connectionLineStyles.${style}`)}
                          aria-label={t(`settlement.connectionLineStyles.${style}`)}
                          aria-pressed={active}
                        >
                          <ConnectionLineStylePreview style={style} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {canEdit && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('settlement.connectionEndSymbol')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {SETTLEMENT_CONNECTION_END_SYMBOLS.map((symbol) => {
                      const active = (selectedConnection.endSymbol ?? 'none') === symbol
                      const tip = t(`settlement.connectionEndSymbols.${symbol}`)
                      return (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() =>
                            patchSelectedConnection({
                              endSymbol: symbol === 'none' ? undefined : symbol,
                            })
                          }
                          className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded border transition-colors ${
                            active
                              ? 'border-blood-light text-blood-light bg-blood/10'
                              : 'border-border text-ink-faint hover:text-ink'
                          }`}
                          title={tip}
                          aria-label={tip}
                          aria-pressed={active}
                        >
                          <ConnectionEndSymbolPreview symbol={symbol} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {canEdit && (
                <Button variant="danger" className="text-xs" onClick={removeSelectedConnection}>
                  {t('settlement.removeConnection')}
                </Button>
              )}
            </>
          ) : selected && selectedDef ? (
            <>
              <p className="text-sm text-ink font-medium">
                {selected.label.trim()
                  || constructionLocalizedName(selectedDef, i18n.language)}
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                {constructionLocalizedDescription(selectedDef, i18n.language)}
              </p>
              <p className="text-[11px] font-mono text-ink-faint">
                {t('settlement.complexity')}: {selectedDef.complexity}
                {' · '}
                {t('settlement.time')}: {selectedDef.time}
              </p>
              {selectedDef.properties && (
                <div className="flex flex-wrap gap-1">
                  {parseSettlementProperties(selectedDef.properties).map((tag) => {
                    const rank = settlementPropertyDisplayValue(tag)
                    return (
                      <span
                        key={`${tag.polarity}-${tag.name}-${tag.value}`}
                        className={`inline-flex items-center gap-1 leading-none text-[12px] font-mono pl-1.5 ${rank != null ? 'pr-1' : 'pr-1.5'} py-0.5 rounded-full border ${gearTraitPolarityClasses(tag.polarity)}`}
                      >
                        <span className="uppercase tracking-wider leading-none">
                          {settlementPropertyLabel(tag)}
                        </span>
                        {rank != null && (
                          <TraitValueBadge polarity={tag.polarity} value={rank} />
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
              <p className="text-[11px] text-ink-faint">
                {SETTLEMENT_MATERIALS
                  .filter((m) => (selectedDef.materials[m.key] ?? 0) > 0)
                  .map((m) => `${t(m.labelKey)} × ${selectedDef.materials[m.key]}`)
                  .join(', ') || '—'}
              </p>
              {selectedNpcs.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('settlement.npcsAtBuilding')}
                  </p>
                  <ul className="space-y-1.5">
                    {selectedNpcs.map((npc) => (
                      <li key={npc.id} className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full border border-border overflow-hidden bg-void flex items-center justify-center shrink-0">
                          {npc.imageURL ? (
                            <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FaUser className="w-3 h-3 text-ink-faint" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-ink truncate">
                            {npc.name.trim() || t('settlement.npcUnnamed')}
                          </p>
                          {npc.role.trim() && (
                            <p className="text-[10px] font-mono text-ink-faint truncate">{npc.role}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canEdit && (
                <div className="space-y-2 pt-1 border-t border-border">
                  {selectedCustom && (
                    <GearIconPicker
                      label={t('inventory.visual.icon')}
                      value={selectedCustom.icon ?? ''}
                      onChange={(icon) => updateSelectedCustomConstruction({ icon })}
                    />
                  )}
                  <Input
                    label={t('settlement.customLabel')}
                    value={selected.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    placeholder={constructionLocalizedName(selectedDef, i18n.language)}
                  />
                  <textarea
                    value={selected.notes}
                    onChange={(e) => updateSelected({ notes: e.target.value })}
                    placeholder={t('settlement.constructionNotes')}
                    rows={2}
                    className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                  />
                  <Button variant="danger" className="text-xs" onClick={removeSelected}>
                    {t('settlement.removeConstruction')}
                  </Button>
                </div>
              )}
            </>
          ) : selectedObject && selectedObjectDef ? (
            <>
              <p className="text-sm text-ink font-medium">
                {selectedObject.label.trim()
                  || mapObjectLocalizedName(selectedObjectDef, i18n.language)}
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                {mapObjectLocalizedDescription(selectedObjectDef, i18n.language)}
              </p>
              {canEdit && (
                <div className="space-y-2 pt-1 border-t border-border">
                  <Input
                    label={t('settlement.customLabel')}
                    value={selectedObject.label}
                    onChange={(e) => updateSelectedObject({ label: e.target.value })}
                    placeholder={mapObjectLocalizedName(selectedObjectDef, i18n.language)}
                  />
                  <textarea
                    value={selectedObject.notes}
                    onChange={(e) => updateSelectedObject({ notes: e.target.value })}
                    placeholder={t('settlement.objectNotes')}
                    rows={2}
                    className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                  />
                  <Button variant="danger" className="text-xs" onClick={removeSelectedObject}>
                    {t('settlement.removeObject')}
                  </Button>
                </div>
              )}
            </>
          ) : selectedZone ? (
            <>
              {selectedZone.name.trim() ? (
                <p className="text-sm text-ink font-medium">{selectedZone.name.trim()}</p>
              ) : null}
              <p className="text-xs text-ink-muted">
                {t('settlement.zonePoints', { count: selectedZone.points.length })}
              </p>
              {canEdit && (
                <div className="space-y-2 pt-1 border-t border-border">
                  <Input
                    label={t('settlement.zoneName')}
                    value={selectedZone.name}
                    onChange={(e) => updateSelectedZone({ name: e.target.value })}
                    placeholder={t('settlement.zoneNamePlaceholder')}
                  />
                  <GearIconPicker
                    label={t('inventory.visual.icon')}
                    value={selectedZone.icon ?? ''}
                    onChange={(icon) => updateSelectedZone({ icon })}
                  />
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {t('settlement.zoneColor')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SETTLEMENT_ZONE_COLORS.map((hex) => {
                        const active = (selectedZone.color || DEFAULT_SETTLEMENT_ZONE_COLOR) === hex
                        return (
                          <button
                            key={`zone-color-${hex}`}
                            type="button"
                            title={hex}
                            onClick={() => updateSelectedZone({ color: hex })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                            }`}
                            style={{ backgroundColor: hex }}
                            aria-label={t('settlement.markerColorOption', { color: hex })}
                            aria-pressed={active}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                      {t('settlement.zoneIconColor')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SETTLEMENT_MARKER_COLORS.map((hex) => {
                        const active =
                          (selectedZone.iconColor?.trim() || DEFAULT_SETTLEMENT_ZONE_ICON_COLOR) === hex
                        return (
                          <button
                            key={`zone-icon-${hex}`}
                            type="button"
                            title={hex}
                            onClick={() =>
                              updateSelectedZone({
                                iconColor:
                                  hex === DEFAULT_SETTLEMENT_ZONE_ICON_COLOR ? undefined : hex,
                              })
                            }
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                            }`}
                            style={{ backgroundColor: hex }}
                            aria-label={t('settlement.markerColorOption', { color: hex })}
                            aria-pressed={active}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <Button variant="danger" className="text-xs" onClick={removeSelectedZone}>
                    {t('settlement.removeZone')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-faint">
              {zoneDrawMode
                ? t('settlement.zoneDrawHint')
                : linkMode === 'connect'
                  ? t('settlement.connectModeHint')
                  : linkMode === 'disconnect'
                    ? t('settlement.disconnectModeHint')
                    : t('settlement.selectMapItem')}
            </p>
          )}
        </aside>

        {selected && selectedDef && canEdit && (
          <aside className="rounded-lg border border-border bg-surface/60 p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('settlement.markerIconColor')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SETTLEMENT_MARKER_COLORS.map((hex) => {
                  const active = settlementMarkerIconColor(selected.iconColor) === hex
                  return (
                    <button
                      key={`icon-${hex}`}
                      type="button"
                      title={hex}
                      onClick={() =>
                        updateSelected({
                          iconColor:
                            hex === DEFAULT_SETTLEMENT_MARKER_ICON_COLOR ? undefined : hex,
                        })
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={t('settlement.markerColorOption', { color: hex })}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('settlement.markerBgColor')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SETTLEMENT_MARKER_COLORS.map((hex) => {
                  const active = settlementMarkerBgColor(selected.bgColor) === hex
                  return (
                    <button
                      key={`bg-${hex}`}
                      type="button"
                      title={hex}
                      onClick={() =>
                        updateSelected({
                          bgColor:
                            hex === DEFAULT_SETTLEMENT_MARKER_BG_COLOR ? undefined : hex,
                        })
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={t('settlement.markerColorOption', { color: hex })}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
            {selectedLinks.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('settlement.connectionsOf')}
                  </p>
                  <button
                    type="button"
                    className="text-[10px] font-mono uppercase tracking-wider text-blood hover:text-blood-light"
                    onClick={removeLinksOfSelected}
                  >
                    {t('settlement.removeConstructionLinks')}
                  </button>
                </div>
                <ul className="space-y-1">
                  {selectedLinks.map(({ connection, other }) => (
                    <li
                      key={connection.id}
                      className="flex items-center justify-between gap-2 text-xs text-ink-muted"
                    >
                      <button
                        type="button"
                        className="min-w-0 truncate text-left hover:text-ink"
                        onClick={() => selectConnection(connection.id)}
                      >
                        ↔ {constructionLabel(other)}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-blood hover:text-blood-light"
                        onClick={() => removeConnectionById(connection.id)}
                      >
                        {t('settlement.removeConnectionShort')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}

        {selectedObject && selectedObjectDef && canEdit && (
          <aside className="rounded-lg border border-border bg-surface/60 p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('settlement.markerIconColor')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SETTLEMENT_MARKER_COLORS.map((hex) => {
                  const fallback = selectedObjectDef.defaultIconColor
                  const active = (selectedObject.iconColor?.trim() || fallback) === hex
                  return (
                    <button
                      key={`obj-icon-${hex}`}
                      type="button"
                      title={hex}
                      onClick={() =>
                        updateSelectedObject({
                          iconColor: hex === fallback ? undefined : hex,
                        })
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={t('settlement.markerColorOption', { color: hex })}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('settlement.markerBgColor')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SETTLEMENT_MARKER_COLORS.map((hex) => {
                  const fallback = selectedObjectDef.defaultBgColor
                  const active = (selectedObject.bgColor?.trim() || fallback) === hex
                  return (
                    <button
                      key={`obj-bg-${hex}`}
                      type="button"
                      title={hex}
                      onClick={() =>
                        updateSelectedObject({
                          bgColor: hex === fallback ? undefined : hex,
                        })
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        active ? 'border-ink scale-110' : 'border-border hover:border-ink-muted'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={t('settlement.markerColorOption', { color: hex })}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
          </aside>
        )}
        </div>
      </div>

      <ConstructionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addConstruction}
        customConstructions={settlement.customConstructions}
        onCreateCustom={createCustomConstruction}
      />
      <MapObjectPicker
        open={objectPickerOpen}
        onClose={() => setObjectPickerOpen(false)}
        onPick={addObject}
      />
        </>
      )}
    </div>
  )
}
