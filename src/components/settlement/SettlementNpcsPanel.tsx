import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  resolveSettlementConstruction,
} from '@/config/settlementConstructions'
import type {
  CampaignNpc,
  SettlementConstructionInstance,
  SettlementCustomConstruction,
  SettlementNpc,
} from '@/types'
import {
  availableCampaignNpcsForSettlement,
  newSettlementNpc,
  settlementNpcFromCampaign,
} from '@/utils/settlement'

interface Props {
  gameId: string
  npcs: SettlementNpc[]
  campaignNpcs: CampaignNpc[]
  constructions: SettlementConstructionInstance[]
  customConstructions?: SettlementCustomConstruction[]
  canEdit: boolean
  onChange: (npcs: SettlementNpc[]) => void
}

function npcMatchesQuery(npc: CampaignNpc, q: string): boolean {
  if (!q) return true
  const hay = `${npc.name} ${npc.role}`.toLocaleLowerCase('pl')
  return hay.includes(q)
}

export default function SettlementNpcsPanel({
  gameId,
  npcs,
  campaignNpcs,
  constructions,
  customConstructions = [],
  canEdit,
  onChange,
}: Props) {
  const { t, i18n } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const addBoxRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropNpcId, setCropNpcId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const roleSuggestionsRaw = t('settlement.npcRoleSuggestions', { returnObjects: true })
  const roleSuggestions = Array.isArray(roleSuggestionsRaw)
    ? roleSuggestionsRaw.filter((r): r is string => typeof r === 'string')
    : []

  const availableCampaign = availableCampaignNpcsForSettlement(campaignNpcs, npcs)
  const queryNorm = query.trim().toLocaleLowerCase('pl')
  const filteredCampaign = useMemo(
    () => availableCampaign.filter((npc) => npcMatchesQuery(npc, queryNorm)),
    [availableCampaign, queryNorm],
  )

  useEffect(() => {
    setHighlight(0)
  }, [queryNorm, open])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (!addBoxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function constructionLabel(id: string): string {
    const item = constructions.find((c) => c.id === id)
    if (!item) return t('settlement.npcUnassigned')
    const def = resolveSettlementConstruction(item.catalogKey, customConstructions)
    return item.label.trim()
      || (def ? constructionLocalizedName(def, i18n.language) : item.catalogKey)
  }

  function update(id: string, patch: Partial<SettlementNpc>) {
    onChange(npcs.map((npc) => (npc.id === id ? { ...npc, ...patch } : npc)))
  }

  function remove(id: string) {
    onChange(npcs.filter((npc) => npc.id !== id))
  }

  function resetAddForm() {
    setQuery('')
    setOpen(false)
    setHighlight(0)
  }

  function addNew(name = query.trim()) {
    const npc = newSettlementNpc()
    if (name) npc.name = name
    onChange([...npcs, npc])
    resetAddForm()
  }

  function addFromCampaign(campaignId: string) {
    const campaign = availableCampaign.find((n) => n.id === campaignId)
    if (!campaign) return
    onChange([...npcs, settlementNpcFromCampaign(campaign)])
    resetAddForm()
  }

  function submitAdd() {
    addNew()
  }

  function onAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      if (filteredCampaign.length === 0) return
      setHighlight((h) => Math.min(h + 1, filteredCampaign.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filteredCampaign.length > 0) {
        addFromCampaign(filteredCampaign[highlight].id)
        return
      }
      addNew()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
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
        <div ref={addBoxRef} className="relative rounded-lg border border-border bg-elevated/30 p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onAddKeyDown}
                placeholder={t('settlement.npcAddPlaceholder')}
                className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-blood/50"
              />
              {open && (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute z-20 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded border border-border bg-surface py-1 shadow-xl shadow-void/40"
                >
                  {filteredCampaign.map((npc, idx) => (
                    <li
                      key={npc.id}
                      role="option"
                      aria-selected={idx === highlight}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addFromCampaign(npc.id)
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border/50 last:border-b-0 transition-colors ${
                        idx === highlight
                          ? 'bg-elevated text-ink border-l-2 border-l-blood/70 pl-[calc(0.75rem-2px)]'
                          : 'border-l-2 border-l-transparent text-ink-muted hover:bg-elevated/60 hover:text-ink'
                      }`}
                    >
                      <span className="w-6 h-6 rounded border border-border overflow-hidden bg-void shrink-0 flex items-center justify-center">
                        {npc.imageURL ? (
                          <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FaUser className="w-3 h-3 text-ink-faint" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {npc.name.trim() || t('settlement.npcUnnamed')}
                      </span>
                      {npc.role.trim() && (
                        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                          {npc.role.trim()}
                        </span>
                      )}
                    </li>
                  ))}
                  {query.trim() ? (
                    <li
                      role="option"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addNew(query.trim())
                      }}
                      className={`px-3 py-2 cursor-pointer text-sm text-blood-light hover:bg-elevated/60 ${
                        filteredCampaign.length > 0 ? 'border-t border-border/60' : ''
                      }`}
                    >
                      {t('settlement.npcCreateHint', { name: query.trim() })}
                    </li>
                  ) : filteredCampaign.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-ink-faint">
                      {campaignNpcs.length === 0
                        ? t('settlement.npcNoCampaign')
                        : availableCampaign.length === 0
                          ? t('settlement.npcAllLinked')
                          : t('settlement.npcTypeToFilter')}
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
            <Button variant="outline" className="text-xs shrink-0" onClick={submitAdd}>
              {t('settlement.npcAdd')}
            </Button>
          </div>
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
