import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaUser } from 'react-icons/fa'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/config/firebase'
import Button from '@/components/ui/Button'
import ImageCropModal from '@/components/ui/ImageCropModal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import {
  constructionLocalizedName,
  getSettlementConstruction,
} from '@/config/settlementConstructions'
import type {
  CampaignNpc,
  SettlementConstructionInstance,
  SettlementNpc,
} from '@/types'
import {
  availableCampaignNpcsForSettlement,
  newSettlementNpc,
  settlementNpcFromCampaign,
} from '@/utils/settlement'

type AddMode = 'pick' | 'create'

interface Props {
  gameId: string
  npcs: SettlementNpc[]
  campaignNpcs: CampaignNpc[]
  constructions: SettlementConstructionInstance[]
  canEdit: boolean
  onChange: (npcs: SettlementNpc[]) => void
}

export default function SettlementNpcsPanel({
  gameId,
  npcs,
  campaignNpcs,
  constructions,
  canEdit,
  onChange,
}: Props) {
  const { t, i18n } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropNpcId, setCropNpcId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>('pick')
  const [pickNpcId, setPickNpcId] = useState('')

  const roleSuggestionsRaw = t('settlement.npcRoleSuggestions', { returnObjects: true })
  const roleSuggestions = Array.isArray(roleSuggestionsRaw)
    ? roleSuggestionsRaw.filter((r): r is string => typeof r === 'string')
    : []

  const availableCampaign = availableCampaignNpcsForSettlement(campaignNpcs, npcs)

  function constructionLabel(id: string): string {
    const item = constructions.find((c) => c.id === id)
    if (!item) return t('settlement.npcUnassigned')
    const def = getSettlementConstruction(item.catalogKey)
    return item.label.trim()
      || (def ? constructionLocalizedName(def, i18n.language) : item.catalogKey)
  }

  function update(id: string, patch: Partial<SettlementNpc>) {
    onChange(npcs.map((npc) => (npc.id === id ? { ...npc, ...patch } : npc)))
  }

  function remove(id: string) {
    onChange(npcs.filter((npc) => npc.id !== id))
  }

  function addNew() {
    onChange([...npcs, newSettlementNpc()])
    setAddMode('pick')
  }

  function addFromCampaign() {
    if (!pickNpcId) return
    const campaign = campaignNpcs.find((n) => n.id === pickNpcId)
    if (!campaign) return
    if (npcs.some((n) => n.campaignNpcId === campaign.id)) return
    onChange([...npcs, settlementNpcFromCampaign(campaign)])
    setPickNpcId('')
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
    setUploadingId(npcId)
    try {
      const storageRef = ref(storage, `games/${gameId}/settlement/npcs/${npcId}/avatar`)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      update(npcId, { imageURL: url })
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

  function clearImage(id: string) {
    update(id, { imageURL: '' })
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('settlement.npcsSection')}
        </h3>
        <p className="text-xs text-ink-faint mt-1">{t('settlement.npcsHint')}</p>
      </div>

      {canEdit && (
        <div className="rounded-lg border border-border bg-elevated/30 p-3 space-y-2">
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
              {t('settlement.npcModePick')}
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
              {t('settlement.npcModeCreate')}
            </button>
          </div>

          {addMode === 'pick' ? (
            availableCampaign.length === 0 ? (
              <p className="text-xs text-ink-faint">
                {campaignNpcs.length === 0
                  ? t('settlement.npcNoCampaign')
                  : t('settlement.npcAllLinked')}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={pickNpcId}
                  onChange={(e) => setPickNpcId(e.target.value)}
                  className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">{t('settlement.npcPickPlaceholder')}</option>
                  {availableCampaign.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.name.trim() || t('settlement.npcUnnamed')}
                      {npc.role.trim() ? ` — ${npc.role.trim()}` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="text-xs shrink-0"
                  disabled={!pickNpcId}
                  onClick={addFromCampaign}
                >
                  {t('settlement.npcAddFromCampaign')}
                </Button>
              </div>
            )
          ) : (
            <Button variant="outline" className="text-xs" onClick={addNew}>
              {t('settlement.addNpc')}
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {npcs.length === 0 ? (
        <p className="text-sm text-ink-faint">{t('settlement.noNpcs')}</p>
      ) : (
        <ul className="space-y-2">
          {npcs.map((npc) => (
            <li
              key={npc.id}
              className="rounded-lg border border-border bg-elevated/40 px-2.5 py-2 flex gap-3"
            >
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div className="relative w-14 h-14 rounded-md border border-border overflow-hidden bg-void flex items-center justify-center">
                  {npc.imageURL ? (
                    <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FaUser className="w-5 h-5 text-ink-faint" aria-hidden />
                  )}
                  {uploadingId === npc.id && (
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
                      {npc.imageURL ? t('settlement.npcChangeImage') : t('settlement.npcUploadImage')}
                    </button>
                    {npc.imageURL && (
                      <button
                        type="button"
                        className="text-[10px] font-mono text-blood hover:text-blood-light"
                        onClick={() => clearImage(npc.id)}
                      >
                        {t('settlement.npcClearImage')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {canEdit ? (
                  <>
                    {npc.campaignNpcId && (
                      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                        {t('settlement.npcFromCampaign')}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={npc.name}
                        onChange={(e) => update(npc.id, { name: e.target.value })}
                        placeholder={t('settlement.npcName')}
                      />
                      <Input
                        value={npc.role}
                        onChange={(e) => update(npc.id, { role: e.target.value })}
                        placeholder={t('settlement.npcRole')}
                        list="settlement-npc-roles"
                      />
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                        {t('settlement.npcBuilding')}
                      </span>
                      <select
                        value={npc.constructionId}
                        onChange={(e) => update(npc.id, { constructionId: e.target.value })}
                        className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                      >
                        <option value="">{t('settlement.npcUnassigned')}</option>
                        {constructions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {constructionLabel(c.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      value={npc.notes}
                      onChange={(e) => update(npc.id, { notes: e.target.value })}
                      placeholder={t('settlement.npcNotes')}
                      rows={2}
                      className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink resize-y"
                    />
                    <Button variant="danger" className="text-[10px] py-1" onClick={() => remove(npc.id)}>
                      {t('settlement.removeNpc')}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-ink font-medium">
                      {npc.name.trim() || t('settlement.npcUnnamed')}
                    </p>
                    {npc.role.trim() && (
                      <p className="text-xs text-blood-light/90 font-mono uppercase tracking-wider">
                        {npc.role.trim()}
                      </p>
                    )}
                    <p className="text-[11px] text-ink-faint">
                      {npc.constructionId
                        ? constructionLabel(npc.constructionId)
                        : t('settlement.npcUnassigned')}
                    </p>
                    {npc.notes.trim() && (
                      <p className="text-xs text-ink-muted whitespace-pre-wrap">{npc.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <datalist id="settlement-npc-roles">
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
