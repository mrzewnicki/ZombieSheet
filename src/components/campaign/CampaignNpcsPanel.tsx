import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaUser } from 'react-icons/fa'
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/config/firebase'
import Button from '@/components/ui/Button'
import ImageCropModal from '@/components/ui/ImageCropModal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import type { CampaignNpc } from '@/types'
import {
  CAMPAIGN_NPCS_COLLECTION,
  campaignNpcPayload,
  newCampaignNpc,
} from '@/utils/campaignNpcs'

interface Props {
  gameId: string
  npcs: CampaignNpc[]
  canEdit: boolean
}

export default function CampaignNpcsPanel({ gameId, npcs, canEdit }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState<Record<string, CampaignNpc>>({})
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropNpcId, setCropNpcId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDrafts(Object.fromEntries(npcs.map((n) => [n.id, n])))
  }, [npcs])

  const roleSuggestionsRaw = t('campaignNpcs.roleSuggestions', { returnObjects: true })
  const roleSuggestions = Array.isArray(roleSuggestionsRaw)
    ? roleSuggestionsRaw.filter((r): r is string => typeof r === 'string')
    : []

  function patchDraft(id: string, partial: Partial<CampaignNpc>) {
    setDrafts((prev) => {
      const base = prev[id] ?? npcs.find((n) => n.id === id)
      if (!base) return prev
      return { ...prev, [id]: { ...base, ...partial } }
    })
  }

  async function persist(npc: CampaignNpc) {
    setSavingId(npc.id)
    setError(null)
    try {
      const existing = npcs.find((n) => n.id === npc.id)
      await setDoc(
        doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, npc.id),
        {
          ...campaignNpcPayload(npc, {
            preserveCreatedByUid: existing?.createdByUid,
            createdByUid: npc.createdByUid ?? existing?.createdByUid ?? user?.uid,
          }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    } finally {
      setSavingId(null)
    }
  }

  async function saveDraft(id: string) {
    const draft = drafts[id]
    if (!draft || !canEdit) return
    const original = npcs.find((n) => n.id === id)
    if (
      original
      && original.name === draft.name
      && original.role === draft.role
      && original.notes === draft.notes
      && original.imageURL === draft.imageURL
    ) {
      return
    }
    await persist({
      ...draft,
      createdByUid: draft.createdByUid ?? original?.createdByUid,
    })
  }

  async function add() {
    if (!canEdit || !user) return
    setError(null)
    try {
      const npc = newCampaignNpc(user.uid)
      await setDoc(doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, npc.id), {
        ...campaignNpcPayload(npc, { createdByUid: user.uid }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    }
  }

  async function remove(id: string) {
    if (!canEdit) return
    setError(null)
    try {
      await deleteDoc(doc(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION, id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaignNpcs.saveError'))
    }
  }

  function openCrop(npcId: string) {
    setCropNpcId(npcId)
    fileRef.current?.click()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !cropNpcId) return
    setCropSrc(URL.createObjectURL(file))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    const npcId = cropNpcId
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (!npcId) return
    const npc = drafts[npcId] ?? npcs.find((n) => n.id === npcId)
    if (!npc) return
    setUploadingId(npcId)
    try {
      const storageRef = ref(storage, `games/${gameId}/npcs/${npcId}/avatar`)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      const next = { ...npc, imageURL: url }
      setDrafts((prev) => ({ ...prev, [npcId]: next }))
      await persist(next)
    } finally {
      setUploadingId(null)
      setCropNpcId(null)
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropNpcId(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
            {t('campaignNpcs.section')}
          </h3>
          <p className="text-xs text-ink-faint mt-1">{t('campaignNpcs.hint')}</p>
        </div>
        {canEdit && (
          <Button variant="outline" className="text-xs shrink-0" onClick={() => void add()}>
            {t('campaignNpcs.add')}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-blood">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {npcs.length === 0 ? (
        <p className="text-sm text-ink-faint">{t('campaignNpcs.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {npcs.map((npc) => {
            const draft = drafts[npc.id] ?? npc
            return (
              <li
                key={npc.id}
                className="rounded-lg border border-border bg-elevated/40 px-2.5 py-2 flex gap-3"
              >
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="relative w-14 h-14 rounded-md border border-border overflow-hidden bg-void flex items-center justify-center">
                    {draft.imageURL ? (
                      <img src={draft.imageURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FaUser className="w-5 h-5 text-ink-faint" aria-hidden />
                    )}
                    {(uploadingId === npc.id || savingId === npc.id) && (
                      <div className="absolute inset-0 bg-void/70 flex items-center justify-center">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        className="text-[10px] font-mono text-ink-faint hover:text-ink"
                        onClick={() => openCrop(npc.id)}
                        disabled={uploadingId === npc.id}
                      >
                        {draft.imageURL ? t('campaignNpcs.changeImage') : t('campaignNpcs.uploadImage')}
                      </button>
                      {draft.imageURL && (
                        <button
                          type="button"
                          className="text-[10px] font-mono text-blood hover:text-blood-light"
                          onClick={() => {
                            const next = { ...draft, imageURL: '' }
                            setDrafts((prev) => ({ ...prev, [npc.id]: next }))
                            void persist(next)
                          }}
                        >
                          {t('campaignNpcs.clearImage')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {canEdit ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={draft.name}
                          onChange={(e) => patchDraft(npc.id, { name: e.target.value })}
                          onBlur={() => void saveDraft(npc.id)}
                          placeholder={t('campaignNpcs.name')}
                        />
                        <Input
                          value={draft.role}
                          onChange={(e) => patchDraft(npc.id, { role: e.target.value })}
                          onBlur={() => void saveDraft(npc.id)}
                          placeholder={t('campaignNpcs.role')}
                          list="campaign-npc-roles"
                        />
                      </div>
                      <textarea
                        value={draft.notes}
                        onChange={(e) => patchDraft(npc.id, { notes: e.target.value })}
                        onBlur={() => void saveDraft(npc.id)}
                        placeholder={t('campaignNpcs.notes')}
                        rows={2}
                        className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink resize-y"
                      />
                      <Button variant="danger" className="text-[10px] py-1" onClick={() => void remove(npc.id)}>
                        {t('campaignNpcs.remove')}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-ink font-medium">
                        {draft.name.trim() || t('campaignNpcs.unnamed')}
                      </p>
                      {draft.role.trim() && (
                        <p className="text-xs text-blood-light/90 font-mono uppercase tracking-wider">
                          {draft.role.trim()}
                        </p>
                      )}
                      {draft.notes.trim() && (
                        <p className="text-xs text-ink-muted whitespace-pre-wrap">{draft.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <datalist id="campaign-npc-roles">
        {roleSuggestions.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={(blob) => void handleCropConfirm(blob)}
          onCancel={handleCropCancel}
        />
      )}
    </section>
  )
}
