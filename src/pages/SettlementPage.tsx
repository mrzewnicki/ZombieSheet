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
  getSettlementConstruction,
} from '@/config/settlementConstructions'
import { SETTLEMENT_MATERIALS, type SettlementMaterialKey } from '@/config/settlementMaterials'
import ConstructionPicker from '@/components/settlement/ConstructionPicker'
import SettlementMap, { type SettlementLinkMode } from '@/components/settlement/SettlementMap'
import SettlementMaterialsPanel from '@/components/settlement/SettlementMaterialsPanel'
import SettlementNpcsPanel from '@/components/settlement/SettlementNpcsPanel'
import SettlementTraitsPanel from '@/components/settlement/SettlementTraitsPanel'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutContext } from '@/contexts/LayoutContext'
import { useCampaignNpcs } from '@/hooks/useCampaignNpcs'
import { useGameRole } from '@/hooks/useGameRole'
import type { Game, Settlement, SettlementConstructionInstance } from '@/types'
import {
  SETTLEMENT_COLLECTION,
  SETTLEMENT_DOC_ID,
  newConstructionInstance,
  normalizeSettlement,
  pruneSettlementNpcs,
  settlementPayload,
} from '@/utils/settlement'
import {
  connectionExists,
  connectToNearest,
  fillMissingMstConnections,
  newSettlementConnection,
  pruneSettlementConnections,
  removeConnectionBetween,
  removeConnectionsForConstruction,
} from '@/utils/settlementConnections'
import { gearTraitPolarityClasses } from '@/utils/gearTraits'
import {
  parseSettlementProperties,
  settlementPropertyDisplayValue,
  settlementPropertyPrefix,
} from '@/utils/settlementProperties'

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
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState<SettlementLinkMode>('off')
  const [linkFromId, setLinkFromId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'osada' | 'npc'>('osada')
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

  function updateSelected(patchItem: Partial<SettlementConstructionInstance>) {
    if (!settlement || !selectedId) return
    patch({
      constructions: settlement.constructions.map((c) =>
        c.id === selectedId ? { ...c, ...patchItem } : c,
      ),
    })
  }

  function removeSelected() {
    if (!settlement || !selectedId) return
    const constructions = settlement.constructions.filter((c) => c.id !== selectedId)
    patch({
      constructions,
      connections: pruneSettlementConnections(settlement.connections, constructions),
      npcs: pruneSettlementNpcs(settlement.npcs, constructions),
    })
    setSelectedId(null)
  }

  function addConstruction(catalogKey: string) {
    if (!settlement) return
    const instance = newConstructionInstance(catalogKey, 40 + Math.random() * 20, 40 + Math.random() * 20)
    const constructions = [...settlement.constructions, instance]
    const connections = connectToNearest(settlement.connections, constructions, instance.id)
    patch({ constructions, connections })
    setSelectedId(instance.id)
    setSelectedConnectionId(null)
    setPickerOpen(false)
  }

  function setMapLinkMode(mode: SettlementLinkMode) {
    setLinkMode((prev) => (prev === mode ? 'off' : mode))
    setLinkFromId(null)
    setSelectedConnectionId(null)
  }

  function handleLinkPick(id: string) {
    if (!settlement || !canEdit || linkMode === 'off') return
    if (!linkFromId) {
      setLinkFromId(id)
      setSelectedId(id)
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
    // With a construction selected: link only that one to its nearest neighbor.
    if (selectedId) {
      patch({
        connections: connectToNearest(settlement.connections, settlement.constructions, selectedId),
      })
      return
    }
    // Otherwise: fill missing MST edges only (keeps manual links).
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
      if (pickerOpen || isEditableTarget(e.target)) return

      if (selectedConnectionId) {
        if (!settlement) return
        e.preventDefault()
        patch({
          connections: settlement.connections.filter((c) => c.id !== selectedConnectionId),
        })
        setSelectedConnectionId(null)
        return
      }

      if (selectedId && settlement) {
        e.preventDefault()
        const constructions = settlement.constructions.filter((c) => c.id !== selectedId)
        patch({
          constructions,
          connections: pruneSettlementConnections(settlement.connections, constructions),
          npcs: pruneSettlementNpcs(settlement.npcs, constructions),
        })
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canEdit, patch, pickerOpen, selectedConnectionId, selectedId, settlement])

  function selectConstruction(id: string | null) {
    setSelectedId(id)
    if (id) setSelectedConnectionId(null)
  }

  function selectConnection(id: string | null) {
    setSelectedConnectionId(id)
    if (id) setSelectedId(null)
  }

  const selected = settlement?.constructions.find((c) => c.id === selectedId) ?? null
  const selectedDef = selected ? getSettlementConstruction(selected.catalogKey) : undefined
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
    const def = getSettlementConstruction(item.catalogKey)
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
            <>
              <Input
                value={settlement.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t('settlement.namePlaceholder')}
                className="font-heading text-lg"
              />
              <textarea
                value={settlement.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder={t('settlement.descriptionPlaceholder')}
                rows={2}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink resize-y"
              />
            </>
          ) : (
            <>
              <h2 className="font-heading text-lg text-blood-light tracking-wide">
                {settlement.name.trim() || t('settlement.title')}
              </h2>
              {settlement.description && (
                <p className="text-sm text-ink-muted whitespace-pre-wrap">{settlement.description}</p>
              )}
            </>
          )}
          <p className="text-xs text-ink-faint">{t('settlement.sharedHint')}</p>
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
                  title={selectedId
                    ? t('settlement.generateConnectionsSelectedHint')
                    : t('settlement.generateConnectionsHint')}
                >
                  {selectedId
                    ? t('settlement.generateConnectionsSelected')
                    : t('settlement.generateConnections')}
                </Button>
                <Button variant="outline" className="text-xs" onClick={() => setPickerOpen(true)}>
                  {t('settlement.addConstruction')}
                </Button>
              </div>
            )}
          </div>
          <SettlementMap
            constructions={settlement.constructions}
            connections={settlement.connections}
            npcs={settlement.npcs}
            selectedId={selectedId}
            selectedConnectionId={selectedConnectionId}
            linkMode={linkMode}
            linkFromId={linkFromId}
            canEdit={canEdit}
            onSelect={selectConstruction}
            onSelectConnection={selectConnection}
            onLinkPick={handleLinkPick}
            onRemoveConnection={removeConnectionById}
            onMove={moveConstruction}
          />
        </div>

        <aside className="rounded-lg border border-border bg-surface/60 p-3 space-y-3 min-h-[12rem]">
          {selectedConnection ? (
            <>
              <p className="text-sm text-ink font-medium">{t('settlement.connectionTitle')}</p>
              <p className="text-xs text-ink-muted">
                {constructionLabel(connectionFrom)}
                {' ↔ '}
                {constructionLabel(connectionTo)}
              </p>
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
                        className={`inline-flex items-baseline gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${gearTraitPolarityClasses(tag.polarity)}`}
                      >
                        <span>{settlementPropertyPrefix(tag)}</span>
                        {rank != null && (
                          <span className="tabular-nums font-semibold text-[11px] opacity-100 tracking-normal">
                            {rank}
                          </span>
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
                  {selectedLinks.length > 0 && (
                    <div className="space-y-1.5">
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
                  <Button variant="danger" className="text-xs" onClick={removeSelected}>
                    {t('settlement.removeConstruction')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-faint">
              {linkMode === 'connect'
                ? t('settlement.connectModeHint')
                : linkMode === 'disconnect'
                  ? t('settlement.disconnectModeHint')
                  : t('settlement.selectConstruction')}
            </p>
          )}
        </aside>
      </div>

      <ConstructionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addConstruction}
      />
        </>
      )}
    </div>
  )
}
