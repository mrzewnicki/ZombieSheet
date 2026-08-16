import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaUser } from 'react-icons/fa'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/config/firebase'
import HeroNpcGraph from '@/components/hero/HeroNpcGraph'
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
  pruneHeroNpcRelations,
  relationOtherEnd,
  relationTouches,
} from '@/utils/heroNpcRelations'

type AddMode = 'pick' | 'create'

const STANCES: HeroNpcStance[] = ['ally', 'enemy', 'neutral']

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
  const [addMode, setAddMode] = useState<AddMode>('pick')
  const [pickTargetId, setPickTargetId] = useState('')
  const [pickLabel, setPickLabel] = useState('')
  const [pickStance, setPickStance] = useState<HeroNpcStance>('neutral')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newStance, setNewStance] = useState<HeroNpcStance>('neutral')
  const [editLabel, setEditLabel] = useState('')
  const [editStance, setEditStance] = useState<HeroNpcStance>('neutral')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingArt, setUploadingArt] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const relations = useMemo(
    () => pruneHeroNpcRelations(normalizeHeroNpcRelations(hero.npcRelations), npcs),
    [hero.npcRelations, npcs],
  )

  const selectedRelation = relations.find((r) => r.id === selectedRelationId) ?? null
  const selectedNpc =
    selectedNodeId && selectedNodeId !== HERO_NPC_NODE_ID
      ? npcs.find((n) => n.id === selectedNodeId) ?? null
      : null
  const selectedIsHero = selectedNodeId === HERO_NPC_NODE_ID
  const linkFromId = selectedNodeId ?? HERO_NPC_NODE_ID

  const canEditNpcArt = Boolean(
    selectedNpc
    && user
    && (isGm || selectedNpc.createdByUid === user.uid),
  )

  const nodeRelations = useMemo(() => {
    if (!selectedNodeId) return []
    return relations.filter((r) => relationTouches(r, selectedNodeId))
  }, [relations, selectedNodeId])

  useEffect(() => {
    setEditLabel(selectedRelation?.label ?? '')
    setEditStance(selectedRelation?.stance ?? 'neutral')
  }, [selectedRelation?.id, selectedRelation?.label, selectedRelation?.stance])

  const connectTargets = useMemo(() => {
    const options: { id: string; label: string }[] = []
    if (linkFromId !== HERO_NPC_NODE_ID) {
      options.push({ id: HERO_NPC_NODE_ID, label: heroFullName(hero, t('hero.npc.legendHero')) })
    }
    for (const npc of npcs) {
      if (npc.id === linkFromId) continue
      if (findRelationBetween(relations, linkFromId, npc.id)) continue
      options.push({
        id: npc.id,
        label: npc.name.trim() || t('campaignNpcs.unnamed'),
      })
    }
    return options
  }, [hero, linkFromId, npcs, relations, t])

  function nodeLabel(nodeId: string): string {
    if (nodeId === HERO_NPC_NODE_ID) return heroFullName(hero, t('hero.npc.legendHero'))
    const npc = npcs.find((n) => n.id === nodeId)
    return npc?.name.trim() || t('campaignNpcs.unnamed')
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

  async function addRelation() {
    if (!canEdit || !pickTargetId) return
    if (pickTargetId === linkFromId) return
    if (findRelationBetween(relations, linkFromId, pickTargetId)) return
    const next = [
      ...relations,
      newHeroNpcRelation(linkFromId, pickTargetId, pickLabel, pickStance),
    ]
    setPickTargetId('')
    setPickLabel('')
    setPickStance('neutral')
    if (pickTargetId !== HERO_NPC_NODE_ID) setSelectedNodeId(pickTargetId)
    setSelectedRelationId(null)
    await persist(next)
  }

  async function createNpcAndLink() {
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
      const next = [
        ...relations,
        newHeroNpcRelation(linkFromId, npc.id, newLabel, newStance),
      ]
      try {
        await updateField(
          'npcRelations',
          t('hero.npc.fieldLabel'),
          heroNpcRelationPayload(next),
          heroNpcRelationPayload(relations),
        )
      } catch (relErr) {
        throw new Error(
          relErr instanceof Error
            ? `NPC ok, relation failed: ${relErr.message}`
            : 'NPC ok, relation failed',
        )
      }
      setNewName('')
      setNewRole('')
      setNewLabel('')
      setNewStance('neutral')
      setSelectedNodeId(npc.id)
      setSelectedRelationId(null)
      setAddMode('pick')
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

  async function persistNpcArt(npc: CampaignNpc, imageURL: string) {
    if (!user) return
    setError(null)
    try {
      await setDoc(
        doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, npc.id),
        {
          ...campaignNpcPayload(
            { ...npc, imageURL },
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
            {t('hero.npc.title')}
          </h2>
          <p className="text-xs text-ink-faint mt-1 max-w-xl">{t('hero.npc.hint')}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          {saving && <p className="text-[10px] font-mono text-ink-faint">{t('settlement.saving')}</p>}
          {error && <p className="text-xs text-blood max-w-[14rem]">{error}</p>}
          {isGm && (
            <Link
              to={`/game/${gameId}/npcs`}
              className="block text-[10px] font-mono text-blood-light hover:underline"
            >
              {t('campaignNpcs.manageLink')} →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] gap-4 items-start">
        <div className="space-y-3">
          <HeroNpcGraph
            hero={hero}
            npcs={npcs}
            relations={relations}
            selectedNodeId={selectedNodeId}
            selectedRelationId={selectedRelationId}
            onSelectNode={setSelectedNodeId}
            onSelectRelation={setSelectedRelationId}
          />
          {relations.length === 0 && (
            <p className="text-xs text-ink-faint text-center">{t('hero.npc.graphEmpty')}</p>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-surface/60 p-3 space-y-3 min-h-[12rem]">
          {selectedRelation ? (
            <div className="space-y-2">
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
          ) : selectedIsHero || selectedNpc ? (
            <>
              {selectedNpc ? (
                <div className="flex items-start gap-2">
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <span className="relative w-14 h-14 rounded-md border border-border overflow-hidden bg-void flex items-center justify-center">
                      {selectedNpc.imageURL ? (
                        <img src={selectedNpc.imageURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FaUser className="w-5 h-5 text-ink-faint" aria-hidden />
                      )}
                      {uploadingArt && (
                        <div className="absolute inset-0 bg-void/70 flex items-center justify-center">
                          <Spinner size="sm" />
                        </div>
                      )}
                    </span>
                    {canEditNpcArt && (
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          className="text-[10px] font-mono text-ink-faint hover:text-ink"
                          onClick={openArtPicker}
                          disabled={uploadingArt}
                        >
                          {selectedNpc.imageURL
                            ? t('campaignNpcs.changeImage')
                            : t('campaignNpcs.uploadImage')}
                        </button>
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
                      </div>
                    )}
                  </div>
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
              ) : (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('hero.npc.legendHero')}
                  </p>
                  <p className="text-sm text-ink font-medium">
                    {heroFullName(hero, '…')}
                  </p>
                </div>
              )}

              {nodeRelations.length > 0 && (
                <ul className="space-y-1">
                  <li className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    {t('hero.npc.nodeLinks')}
                  </li>
                  {nodeRelations.map((r) => {
                    const other = relationOtherEnd(r, selectedNodeId!)
                    if (!other) return null
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full text-left text-xs rounded border border-border px-2 py-1.5 hover:border-border-light text-ink"
                          onClick={() => {
                            setSelectedRelationId(r.id)
                            setSelectedNodeId(null)
                          }}
                        >
                          <span className="text-ink-faint">→ </span>
                          {nodeLabel(other)}
                          {r.label.trim() ? (
                            <span className="text-ink-faint"> · {r.label.trim()}</span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-faint">{t('hero.npc.selectNode')}</p>
          )}

          {canEdit && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {t('hero.npc.connectFrom', { name: nodeLabel(linkFromId) })}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAddMode('pick')}
                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border transition-colors ${
                    addMode === 'pick'
                      ? 'border-blood-light text-blood-light bg-blood/10'
                      : 'border-border text-ink-faint hover:text-ink'
                  }`}
                >
                  {t('hero.npc.modePick')}
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('create')}
                  className={`flex-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border transition-colors ${
                    addMode === 'create'
                      ? 'border-blood-light text-blood-light bg-blood/10'
                      : 'border-border text-ink-faint hover:text-ink'
                  }`}
                >
                  {t('hero.npc.modeCreate')}
                </button>
              </div>

              {addMode === 'pick' ? (
                connectTargets.length === 0 ? (
                  <p className="text-xs text-ink-faint">
                    {npcs.length === 0 ? t('hero.npc.noCampaignNpcs') : t('hero.npc.allLinkedFrom')}
                  </p>
                ) : (
                  <>
                    <select
                      value={pickTargetId}
                      onChange={(e) => setPickTargetId(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                    >
                      <option value="">{t('hero.npc.pickTarget')}</option>
                      {connectTargets.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <StanceSelect
                      label={t('hero.npc.stanceLabel')}
                      value={pickStance}
                      onChange={setPickStance}
                    />
                    <Input
                      value={pickLabel}
                      onChange={(e) => setPickLabel(e.target.value)}
                      placeholder={t('hero.npc.relationLabelPlaceholder')}
                    />
                    <Button
                      variant="outline"
                      className="text-xs w-full"
                      disabled={!pickTargetId}
                      onClick={() => void addRelation()}
                    >
                      {t('hero.npc.connect')}
                    </Button>
                  </>
                )
              ) : (
                <>
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
                  <StanceSelect
                    label={t('hero.npc.stanceLabel')}
                    value={newStance}
                    onChange={setNewStance}
                  />
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder={t('hero.npc.relationLabelPlaceholder')}
                  />
                  <Button
                    variant="outline"
                    className="text-xs w-full"
                    disabled={!newName.trim()}
                    onClick={() => void createNpcAndLink()}
                  >
                    {t('hero.npc.createAndConnect')}
                  </Button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
