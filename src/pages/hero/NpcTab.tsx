import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaLink, FaUser, FaUserPlus } from 'react-icons/fa'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/config/firebase'
import HeroNpcGraph from '@/components/hero/HeroNpcGraph'
import GearIcon from '@/components/hero/GearIcon'
import GearIconPicker from '@/components/hero/GearIconPicker'
import Button from '@/components/ui/Button'
import ImageCropModal from '@/components/ui/ImageCropModal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useCampaignNpcs } from '@/hooks/useCampaignNpcs'
import { useGameRole } from '@/hooks/useGameRole'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import type { CampaignNpc, HeroNpcStance } from '@/types'
import { heroFullName } from '@/types'
import { hasRenderableGearIcon } from '@/utils/gearIcons'
import {
  CAMPAIGN_NPCS_COLLECTION,
  campaignNpcPayload,
  newCampaignNpc,
} from '@/utils/campaignNpcs'
import {
  HERO_NPC_NODE_ID,
  findRelationBetween,
  heroNpcRelationPayload,
  newHeroNpcRelation,
  normalizeHeroNpcRelations,
  normalizeHeroNpcStance,
  normalizeNpcNodes,
  normalizeNpcPositions,
  npcPositionsPayload,
  pruneHeroNpcRelations,
  pruneNpcNodes,
  pruneNpcPositions,
  graphNpcIds,
  fillMissingNpcPositions,
  relationTouches,
} from '@/utils/heroNpcRelations'

type AddMode = 'pick' | 'create'

const STANCES: HeroNpcStance[] = ['ally', 'enemy', 'neutral']

const PANEL =
  'w-full rounded-lg border border-border bg-void/90 p-2 space-y-2 shadow-lg shadow-void/50'

function StanceSelect({
  value,
  onChange,
  label,
}: {
  value: HeroNpcStance
  onChange: (stance: HeroNpcStance) => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(normalizeHeroNpcStance(e.target.value))}
        className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
      >
        {STANCES.map((stance) => (
          <option key={stance} value={stance}>
            {t(`hero.npc.stance.${stance}`)}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function NpcTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)
  const { role } = useGameRole(gameId)
  const isGm = role === 'gm'
  const { npcs, loading } = useCampaignNpcs(gameId)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode | null>(null)
  const [linkFromId, setLinkFromId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editStance, setEditStance] = useState<HeroNpcStance>('neutral')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingArt, setUploadingArt] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [artUrl, setArtUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const relations = useMemo(
    () => pruneHeroNpcRelations(normalizeHeroNpcRelations(hero.npcRelations), npcs),
    [hero.npcRelations, npcs],
  )
  const extraNodeIds = useMemo(
    () => pruneNpcNodes(normalizeNpcNodes(hero.npcNodes), npcs),
    [hero.npcNodes, npcs],
  )
  const graphIds = useMemo(
    () => graphNpcIds(relations, extraNodeIds),
    [relations, extraNodeIds],
  )
  const savedPositions = useMemo(
    () => pruneNpcPositions(normalizeNpcPositions(hero.npcPositions), graphIds),
    [hero.npcPositions, graphIds],
  )

  const selectedRelation = relations.find((r) => r.id === selectedRelationId) ?? null
  const selectedNpc =
    selectedNodeId && selectedNodeId !== HERO_NPC_NODE_ID
      ? npcs.find((n) => n.id === selectedNodeId) ?? null
      : null

  const canEditNpcArt = Boolean(
    selectedNpc
    && user
    && (isGm || selectedNpc.createdByUid === user.uid),
  )

  useEffect(() => {
    setEditLabel(selectedRelation?.label ?? '')
    setEditStance(selectedRelation?.stance ?? 'neutral')
  }, [selectedRelation?.id, selectedRelation?.label, selectedRelation?.stance])

  useEffect(() => {
    setArtUrl(selectedNpc?.imageURL ?? '')
  }, [selectedNpc?.id, selectedNpc?.imageURL])

  function nodeLabel(nodeId: string): string {
    if (nodeId === HERO_NPC_NODE_ID) return heroFullName(hero, t('hero.npc.legendHero'))
    const npc = npcs.find((n) => n.id === nodeId)
    return npc?.name.trim() || t('campaignNpcs.unnamed')
  }

  async function persistPositions(id: string, x: number, y: number) {
    if (!canEdit) return
    const next = npcPositionsPayload({
      ...savedPositions,
      [id]: { x, y },
    })
    setSaving(true)
    try {
      await updateField(
        'npcPositions',
        t('hero.npc.positionsFieldLabel'),
        next,
        savedPositions,
      )
    } finally {
      setSaving(false)
    }
  }

  async function persist(next: typeof relations) {
    if (!canEdit) return
    setSaving(true)
    try {
      await updateField(
        'npcRelations',
        t('hero.npc.fieldLabel'),
        heroNpcRelationPayload(next),
        heroNpcRelationPayload(relations),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkPick(id: string) {
    if (!canEdit || addMode !== 'pick') return
    if (!linkFromId) {
      setLinkFromId(id)
      setSelectedNodeId(id)
      setSelectedRelationId(null)
      return
    }
    if (linkFromId === id) {
      setLinkFromId(null)
      return
    }
    if (findRelationBetween(relations, linkFromId, id)) {
      setLinkFromId(null)
      setSelectedNodeId(id)
      return
    }
    const next = [
      ...relations,
      newHeroNpcRelation(linkFromId, id),
    ]
    setLinkFromId(null)
    setSelectedNodeId(id)
    setSelectedRelationId(null)
    await persist(next)
  }

  async function createNpc() {
    if (!canEdit || !user || !newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const npc = {
        ...newCampaignNpc(user.uid),
        name: newName.trim(),
        role: newRole.trim(),
      }
      await setDoc(doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, npc.id), {
        ...campaignNpcPayload(npc, { createdByUid: user.uid }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const nextNodes = pruneNpcNodes(
        normalizeNpcNodes([...extraNodeIds, npc.id]),
        [...npcs, npc],
      )
      const nextPositions = fillMissingNpcPositions(
        relations,
        nextNodes,
        savedPositions,
      )
      try {
        await updateField(
          'npcNodes',
          t('hero.npc.nodesFieldLabel'),
          nextNodes,
          extraNodeIds,
        )
        await updateField(
          'npcPositions',
          t('hero.npc.positionsFieldLabel'),
          nextPositions,
          savedPositions,
        )
      } catch (nodesErr) {
        throw new Error(
          nodesErr instanceof Error
            ? `NPC ok, graph failed: ${nodesErr.message}`
            : 'NPC ok, graph failed',
        )
      }
      setNewName('')
      setNewRole('')
      setSelectedNodeId(npc.id)
      setSelectedRelationId(null)
      setAddMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function updateSelectedRelation(patch: Partial<{ label: string; stance: HeroNpcStance }>) {
    if (!canEdit || !selectedRelationId) return
    const next = relations.map((r) =>
      r.id === selectedRelationId ? { ...r, ...patch } : r,
    )
    await persist(next)
  }

  async function removeRelation(relationId: string) {
    if (!canEdit) return
    const next = relations.filter((r) => r.id !== relationId)
    if (selectedRelationId === relationId) setSelectedRelationId(null)
    await persist(next)
  }

  async function removeNodeFromBoard(npcId: string) {
    if (!canEdit || npcId === HERO_NPC_NODE_ID) return
    const nextRelations = relations.filter((r) => !relationTouches(r, npcId))
    const nextNodes = extraNodeIds.filter((id) => id !== npcId)
    const nextPositions = npcPositionsPayload(
      Object.fromEntries(
        Object.entries(savedPositions).filter(([id]) => id !== npcId),
      ),
    )

    setSelectedNodeId(null)
    setSelectedRelationId(null)
    if (linkFromId === npcId) setLinkFromId(null)

    setSaving(true)
    setError(null)
    try {
      if (nextRelations.length !== relations.length) {
        await updateField(
          'npcRelations',
          t('hero.npc.fieldLabel'),
          heroNpcRelationPayload(nextRelations),
          heroNpcRelationPayload(relations),
        )
      }
      if (nextNodes.length !== extraNodeIds.length) {
        await updateField(
          'npcNodes',
          t('hero.npc.nodesFieldLabel'),
          nextNodes,
          extraNodeIds,
        )
      }
      if (savedPositions[npcId]) {
        await updateField(
          'npcPositions',
          t('hero.npc.positionsFieldLabel'),
          nextPositions,
          savedPositions,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    } finally {
      setSaving(false)
    }
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
      if (e.key !== 'Delete') return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (cropSrc || isEditableTarget(e.target)) return

      if (selectedRelationId) {
        e.preventDefault()
        void removeRelation(selectedRelationId)
        return
      }

      if (selectedNodeId && selectedNodeId !== HERO_NPC_NODE_ID) {
        e.preventDefault()
        void removeNodeFromBoard(selectedNodeId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canEdit, cropSrc, selectedNodeId, selectedRelationId, relations, extraNodeIds, savedPositions, linkFromId, t, updateField])

  async function persistNpcFields(npc: CampaignNpc, patch: Partial<CampaignNpc>) {
    if (!user) return
    setError(null)
    try {
      await setDoc(
        doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, npc.id),
        {
          ...campaignNpcPayload(
            { ...npc, ...patch },
            { createdByUid: npc.createdByUid ?? user.uid },
          ),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    }
  }

  async function persistNpcArt(npc: CampaignNpc, imageURL: string) {
    await persistNpcFields(npc, { imageURL })
  }

  async function applyArtUrl() {
    if (!selectedNpc || !canEditNpcArt) return
    const next = artUrl.trim()
    if (next === selectedNpc.imageURL.trim()) return
    await persistNpcArt(selectedNpc, next)
  }

  function openArtPicker() {
    if (!canEditNpcArt) return
    fileRef.current?.click()
  }

  function handleArtFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedNpc) return
    setCropSrc(URL.createObjectURL(file))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleArtCropConfirm(blob: Blob) {
    const npc = selectedNpc
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (!npc) return
    setUploadingArt(true)
    setError(null)
    try {
      const storageRef = ref(storage, `games/${gameId}/npcs/${npc.id}/avatar`)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      await persistNpcArt(npc, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    } finally {
      setUploadingArt(false)
    }
  }

  function handleArtCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function clearNpcArt() {
    if (!selectedNpc || !canEditNpcArt) return
    await persistNpcArt(selectedNpc, '')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArtFileSelect}
      />
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={(blob) => void handleArtCropConfirm(blob)}
          onCancel={handleArtCropCancel}
        />
      )}
      {isGm && (
        <div className="flex justify-end">
          <Link
            to={`/game/${gameId}/npcs`}
            className="block text-[10px] font-mono text-blood-light hover:underline"
          >
            {t('campaignNpcs.manageLink')} →
          </Link>
        </div>
      )}
      {error && (
        <p className="text-xs text-blood text-right max-w-[14rem] ml-auto">{error}</p>
      )}

      <div className="space-y-1">
        <p className="text-xs text-ink-faint">{t('hero.npc.perCharacterHint')}</p>
        <p className="text-xs text-ink-faint">{t('hero.npc.hint')}</p>
      </div>

      <div className="space-y-3">
        <HeroNpcGraph
          hero={hero}
          npcs={npcs}
          relations={relations}
          extraNodeIds={extraNodeIds}
          savedPositions={savedPositions}
          canEdit={canEdit}
          selectedNodeId={selectedNodeId}
          selectedRelationId={selectedRelationId}
          onSelectNode={setSelectedNodeId}
          onSelectRelation={setSelectedRelationId}
          onMoveNode={(id, x, y) => void persistPositions(id, x, y)}
          linking={addMode === 'pick'}
          linkFromId={linkFromId}
          onLinkPick={(id) => void handleLinkPick(id)}
          hint={
            addMode === 'pick'
              ? linkFromId
                ? t('hero.npc.connectFrom', { name: nodeLabel(linkFromId) })
                : t('hero.npc.connectModeHint')
              : undefined
          }
          saving={saving}
          cornerActions={canEdit ? (
            <>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode((m) => (m === 'pick' ? null : 'pick'))
                    setLinkFromId(null)
                  }}
                  title={t('hero.npc.modePick')}
                  aria-label={t('hero.npc.modePick')}
                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors shadow-md shadow-void/50 ${
                    addMode === 'pick'
                      ? 'border-blood-light text-blood-light bg-blood/20'
                      : 'border-border text-ink-faint hover:text-ink bg-void/90'
                  }`}
                >
                  <FaLink className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode((m) => (m === 'create' ? null : 'create'))
                    setLinkFromId(null)
                  }}
                  title={t('hero.npc.modeCreate')}
                  aria-label={t('hero.npc.modeCreate')}
                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors shadow-md shadow-void/50 ${
                    addMode === 'create'
                      ? 'border-blood-light text-blood-light bg-blood/20'
                      : 'border-border text-ink-faint hover:text-ink bg-void/90'
                  }`}
                >
                  <FaUserPlus className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
              {addMode === 'create' && (
                <div className={PANEL}>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('hero.npc.modeCreate')}
                  </p>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('campaignNpcs.name')}
                  />
                  <Input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder={t('campaignNpcs.role')}
                  />
                  <Button
                    variant="outline"
                    className="text-xs w-full"
                    disabled={!newName.trim()}
                    onClick={() => void createNpc()}
                  >
                    {t('hero.npc.create')}
                  </Button>
                </div>
              )}
            </>
          ) : undefined}
          detailPanel={
            selectedRelation ? (
              <div className={PANEL}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {t('hero.npc.edgeTitle')}
                </p>
                <p className="text-sm text-ink">
                  {nodeLabel(selectedRelation.fromId)}
                  <span className="text-ink-faint mx-1">—</span>
                  {nodeLabel(selectedRelation.toId)}
                </p>
                {canEdit ? (
                  <>
                    <StanceSelect
                      label={t('hero.npc.stanceLabel')}
                      value={editStance}
                      onChange={(stance) => {
                        setEditStance(stance)
                        void updateSelectedRelation({ stance })
                      }}
                    />
                    <Input
                      label={t('hero.npc.relationLabel')}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={() => {
                        if (editLabel === selectedRelation.label) return
                        void updateSelectedRelation({ label: editLabel })
                      }}
                      placeholder={t('hero.npc.relationLabelPlaceholder')}
                    />
                    <Button
                      variant="danger"
                      className="text-xs"
                      title="Delete"
                      onClick={() => void removeRelation(selectedRelation.id)}
                    >
                      {t('hero.npc.removeRelation')}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-ink-muted">
                      {t(`hero.npc.stance.${selectedRelation.stance}`)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {selectedRelation.label.trim() || t('hero.npc.noLabel')}
                    </p>
                  </div>
                )}
              </div>
            ) : selectedNpc ? (
              <div className={PANEL}>
                <div className="flex items-start gap-2">
                  <span className="relative w-14 h-14 shrink-0 rounded-md border border-border overflow-hidden bg-void flex items-center justify-center">
                    {selectedNpc.imageURL ? (
                      <img src={selectedNpc.imageURL} alt="" className="w-full h-full object-cover" />
                    ) : hasRenderableGearIcon(selectedNpc.icon ?? '') ? (
                      <GearIcon value={selectedNpc.icon ?? ''} className="w-7 h-7 text-ink-muted" />
                    ) : (
                      <FaUser className="w-5 h-5 text-ink-faint" aria-hidden />
                    )}
                    {uploadingArt && (
                      <div className="absolute inset-0 bg-void/70 flex items-center justify-center">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-sm text-ink font-medium truncate">
                      {selectedNpc.name.trim() || t('campaignNpcs.unnamed')}
                    </p>
                    {selectedNpc.role.trim() && (
                      <p className="text-[10px] font-mono text-ink-faint uppercase tracking-wider truncate">
                        {selectedNpc.role}
                      </p>
                    )}
                  </div>
                </div>
                {canEditNpcArt && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-mono text-ink-faint hover:text-ink"
                        onClick={openArtPicker}
                        disabled={uploadingArt}
                      >
                        {selectedNpc.imageURL
                          ? t('campaignNpcs.changeImage')
                          : t('campaignNpcs.uploadImage')}
                      </button>
                      <input
                        type="url"
                        value={artUrl}
                        onChange={(e) => setArtUrl(e.target.value)}
                        onBlur={() => void applyArtUrl()}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          ;(e.currentTarget as HTMLInputElement).blur()
                        }}
                        placeholder={t('campaignNpcs.imageUrlPlaceholder')}
                        aria-label={t('images.pasteLink')}
                        disabled={uploadingArt}
                        className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-mono text-ink placeholder-ink-faint focus:outline-none focus:border-blood"
                      />
                    </div>
                    {selectedNpc.imageURL && (
                      <button
                        type="button"
                        className="text-[10px] font-mono text-blood hover:text-blood-light"
                        onClick={() => void clearNpcArt()}
                        disabled={uploadingArt}
                      >
                        {t('campaignNpcs.clearImage')}
                      </button>
                    )}
                    <GearIconPicker
                      label={t('campaignNpcs.icon')}
                      value={selectedNpc.icon ?? ''}
                      onChange={(icon) => void persistNpcFields(selectedNpc, { icon })}
                    />
                  </div>
                )}
                {canEdit && (
                  <Button
                    variant="danger"
                    className="text-xs w-full"
                    title="Delete"
                    onClick={() => void removeNodeFromBoard(selectedNpc.id)}
                  >
                    {t('hero.npc.removeFromBoard')}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
        {relations.length === 0 && (
          <p className="text-xs text-ink-faint text-center">{t('hero.npc.graphEmpty')}</p>
        )}
      </div>
    </div>
  )
}
