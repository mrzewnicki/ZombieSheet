import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  EMPTY_ACTIVATION_BY_RANK,
  MUTATION_CHARACTERS,
  MUTATION_KINDS,
  MUTATION_ORIGINS,
  MUTATION_RANKS,
  emptyTraitLine,
  xpCostForRank,
} from '@/config/mutations'
import { MUTATIONS_DOC_URL } from '@/config/rpg-system'
import { contaminationIconSrc } from '@/config/contaminationIcons'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import type {
  HeroContamination,
  HeroMutation,
  MutationCharacter,
  MutationKind,
  MutationOrigin,
  MutationRank,
  MutationTraitLine,
} from '@/types'
import { normalizeMutation } from '@/utils/mutations'
import {
  computeVitalMaxes,
  contaminationTotal,
  dominantContaminationTrack,
  resolveHeroRace,
  resolveHeroVitals,
  type ContaminationTrack,
} from '@/utils/vitals'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import GearStatChip from '@/components/hero/GearStatChip'
import SaveIcon from '@/components/icons/SaveIcon'
import Spinner from '@/components/ui/Spinner'

const CONTAMINATION_TRACKS: ContaminationTrack[] = ['deathNet', 'liveCore', 'anomalie']

type MutationFormData = Omit<HeroMutation, 'id' | 'createdAt' | 'updatedAt'>

const EMPTY_FORM: MutationFormData = {
  name: '',
  origin: 'liveCore',
  kind: 'fizyczna',
  character: 'pasywna',
  rank: 1,
  description: '',
  atuty: [],
  wady: [],
  activationCost: '',
  activationByRank: { ...EMPTY_ACTIVATION_BY_RANK },
  resonance: '',
  hibernating: false,
}

function sanitizeTraitLines(lines: MutationTraitLine[]): MutationTraitLine[] {
  return lines
    .map((line) => ({
      name: line.name.trim(),
      value: Number.isFinite(line.value) ? Math.max(0, Math.trunc(line.value)) : 0,
      description: line.description.trim(),
    }))
    .filter((line) => line.name || line.description)
}

function TraitLinesEditor({
  label,
  lines,
  onChange,
  addLabel,
}: {
  label: string
  lines: MutationTraitLine[]
  onChange: (lines: MutationTraitLine[]) => void
  addLabel: string
}) {
  const { t } = useTranslation()

  function updateLine(index: number, patch: Partial<MutationTraitLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">{label}</p>
        <button
          type="button"
          onClick={() => onChange([...lines, emptyTraitLine()])}
          className="text-xs font-mono text-blood-light hover:text-blood transition-colors"
        >
          + {addLabel}
        </button>
      </div>
      {lines.length === 0 && (
        <p className="text-xs text-ink-faint">{t('mutations.noTraitLines')}</p>
      )}
      {lines.map((line, index) => (
        <div key={index} className="rounded border border-border bg-void/40 p-3 space-y-2">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <Input
                label={t('mutations.traitName')}
                value={line.name}
                onChange={(e) => updateLine(index, { name: e.target.value })}
              />
            </div>
            <div className="w-20 shrink-0">
              <Input
                label={t('mutations.traitValue')}
                type="number"
                min={0}
                value={line.value}
                onChange={(e) => updateLine(index, { value: Number(e.target.value) })}
              />
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">{t('mutations.traitDescription')}</span>
            <textarea
              value={line.description}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              rows={2}
              className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-blood/50 resize-y"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
            className="text-xs font-mono text-blood hover:text-blood-light transition-colors"
          >
            {t('common.delete')}
          </button>
        </div>
      ))}
    </div>
  )
}

function MutationForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving = false,
  mode,
}: {
  data: MutationFormData
  onChange: (data: MutationFormData) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving?: boolean
  mode: 'add' | 'edit'
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border border-blood/25 rounded-lg p-4 space-y-4">
      <p className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
        {mode === 'add' ? t('mutations.add') : t('mutations.edit')}
      </p>

      <Input
        label={t('mutations.name')}
        placeholder={t('mutations.namePlaceholder')}
        value={data.name}
        onChange={(e) => onChange({ ...data, name: e.target.value })}
        autoFocus
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs text-ink-muted inline-flex items-center gap-1.5">
            <img
              src={contaminationIconSrc(data.origin)}
              alt=""
              className="w-4 h-4 object-contain"
              aria-hidden
            />
            {t('mutations.origin')}
          </span>
          <select
            value={data.origin}
            onChange={(e) => onChange({ ...data, origin: e.target.value as MutationOrigin })}
            className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-blood/50"
          >
            {MUTATION_ORIGINS.map((origin) => (
              <option key={origin} value={origin}>{t(`mutations.origins.${origin}`)}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-ink-muted">{t('mutations.kind')}</span>
          <select
            value={data.kind}
            onChange={(e) => onChange({ ...data, kind: e.target.value as MutationKind })}
            className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-blood/50"
          >
            {MUTATION_KINDS.map((kind) => (
              <option key={kind} value={kind}>{t(`mutations.kinds.${kind}`)}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-ink-muted">{t('mutations.character')}</span>
          <select
            value={data.character}
            onChange={(e) => onChange({ ...data, character: e.target.value as MutationCharacter })}
            className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-blood/50"
          >
            {MUTATION_CHARACTERS.map((character) => (
              <option key={character} value={character}>{t(`mutations.characters.${character}`)}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-ink-muted">{t('mutations.rank')}</span>
          <select
            value={data.rank}
            onChange={(e) => onChange({ ...data, rank: Number(e.target.value) as MutationRank })}
            className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-blood/50"
          >
            {MUTATION_RANKS.map((rank) => (
              <option key={rank} value={rank}>
                {rank} — {t(`mutations.ranks.${rank}`)} ({xpCostForRank(rank)} PD)
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-ink-muted">{t('mutations.description')}</span>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={3}
          placeholder={t('mutations.descriptionPlaceholder')}
          className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-blood/50 resize-y"
        />
      </label>

      {data.character === 'pasywna' ? (
        <>
          <TraitLinesEditor
            label={t('mutations.atuty')}
            lines={data.atuty}
            onChange={(atuty) => onChange({ ...data, atuty })}
            addLabel={t('mutations.addTrait')}
          />
          <TraitLinesEditor
            label={t('mutations.wady')}
            lines={data.wady}
            onChange={(wady) => onChange({ ...data, wady })}
            addLabel={t('mutations.addTrait')}
          />
        </>
      ) : (
        <>
          <Input
            label={t('mutations.activationCost')}
            placeholder={t('mutations.activationCostPlaceholder')}
            value={data.activationCost}
            onChange={(e) => onChange({ ...data, activationCost: e.target.value })}
          />
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              {t('mutations.activationByRank')}
            </p>
            {MUTATION_RANKS.map((rank) => (
              <label key={rank} className="block space-y-1">
                <span className="text-xs text-ink-muted">
                  {t('mutations.rank')} {rank} — {t(`mutations.ranks.${rank}`)}
                </span>
                <textarea
                  value={data.activationByRank[rank]}
                  onChange={(e) => onChange({
                    ...data,
                    activationByRank: { ...data.activationByRank, [rank]: e.target.value },
                  })}
                  rows={2}
                  className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-blood/50 resize-y"
                />
              </label>
            ))}
          </div>
        </>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-ink-muted">{t('mutations.resonance')}</span>
        <textarea
          value={data.resonance}
          onChange={(e) => onChange({ ...data, resonance: e.target.value })}
          rows={2}
          placeholder={t('mutations.resonancePlaceholder')}
          className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-blood/50 resize-y"
        />
      </label>

      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={data.hibernating}
          onChange={(e) => onChange({ ...data, hibernating: e.target.checked })}
          className="accent-blood"
        />
        <span className="text-sm text-ink">{t('mutations.hibernating')}</span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={onSubmit} loading={saving} disabled={!data.name.trim()}>
          <span className="inline-flex items-center gap-1.5">
            <SaveIcon />
            {submitLabel}
          </span>
        </Button>
      </div>
    </div>
  )
}

function MutationCard({
  item,
  readOnly,
  onEdit,
  onDelete,
  onToggleHibernating,
}: {
  item: HeroMutation
  readOnly: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleHibernating: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const currentEffect = item.character === 'aktywna'
    ? item.activationByRank[item.rank]?.trim() ?? ''
    : ''
  const previousRank = item.rank > 1 ? ((item.rank - 1) as MutationRank) : null
  const previousEffect = previousRank != null
    ? item.activationByRank[previousRank]?.trim() ?? ''
    : ''

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${
      item.hibernating ? 'border-amber-400/30 opacity-80' : 'border-border'
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-elevated/40 transition-colors"
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-ink text-base">{item.name}</span>
            {item.hibernating && (
              <GearStatChip accent>{t('mutations.hibernatingBadge')}</GearStatChip>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <GearStatChip>
              <span className="inline-flex items-center gap-1">
                <img
                  src={contaminationIconSrc(item.origin)}
                  alt=""
                  className="w-3.5 h-3.5 object-contain"
                  aria-hidden
                />
                {t(`mutations.origins.${item.origin}`)}
              </span>
            </GearStatChip>
            <GearStatChip>{t(`mutations.kinds.${item.kind}`)}</GearStatChip>
            <GearStatChip>{t(`mutations.characters.${item.character}`)}</GearStatChip>
            <GearStatChip accent>
              {t('mutations.rank')} {item.rank} · {t(`mutations.ranks.${item.rank}`)}
            </GearStatChip>
          </div>
        </div>
        <span className="text-ink-faint text-sm shrink-0 mt-1">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {item.description && (
            <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}

          {item.character === 'pasywna' && (
            <>
              {item.atuty.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-emerald-400/80 mb-1">
                    {t('mutations.atuty')}
                  </p>
                  <ul className="space-y-1">
                    {item.atuty.map((line, i) => (
                      <li key={i} className="text-sm text-ink">
                        <span className="font-mono text-blood-light">{line.name}</span>
                        {line.value > 0 && <span className="text-ink-faint"> ({line.value})</span>}
                        {line.description && <span className="text-ink-muted"> — {line.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.wady.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-blood mb-1">
                    {t('mutations.wady')}
                  </p>
                  <ul className="space-y-1">
                    {item.wady.map((line, i) => (
                      <li key={i} className="text-sm text-ink">
                        <span className="font-mono text-blood-light">{line.name}</span>
                        {line.value > 0 && <span className="text-ink-faint"> ({line.value})</span>}
                        {line.description && <span className="text-ink-muted"> — {line.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {item.character === 'aktywna' && (
            <>
              {item.activationCost && (
                <p className="text-sm text-ink">
                  <span className="text-ink-muted">{t('mutations.activationCost')}: </span>
                  {item.activationCost}
                </p>
              )}
              {previousEffect && previousRank != null && (
                <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
                  <span className="text-ink">
                    {t('mutations.rankEffect', {
                      rank: previousRank,
                      rankName: t(`mutations.ranks.${previousRank}`),
                    })}
                    :{' '}
                  </span>
                  {previousEffect}
                </p>
              )}
              {currentEffect && (
                <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
                  <span className="text-ink">
                    {t('mutations.rankEffect', {
                      rank: item.rank,
                      rankName: t(`mutations.ranks.${item.rank}`),
                    })}
                    :{' '}
                  </span>
                  {currentEffect}
                </p>
              )}
            </>
          )}

          {item.resonance && (
            <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
              <span className="text-ink">{t('mutations.resonance')}: </span>
              {item.resonance}
            </p>
          )}

          {!readOnly && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="text-xs" onClick={onToggleHibernating}>
                {item.hibernating ? t('mutations.clearHibernation') : t('mutations.setHibernation')}
              </Button>
              <Button variant="outline" className="text-xs" onClick={onEdit}>
                {t('common.edit')}
              </Button>
              <Button variant="danger" className="text-xs" onClick={onDelete}>
                {t('common.delete')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toPayload(data: MutationFormData) {
  return {
    name: data.name.trim(),
    origin: data.origin,
    kind: data.kind,
    character: data.character,
    rank: data.rank,
    description: data.description.trim(),
    atuty: data.character === 'pasywna' ? sanitizeTraitLines(data.atuty) : [],
    wady: data.character === 'pasywna' ? sanitizeTraitLines(data.wady) : [],
    activationCost: data.character === 'aktywna' ? data.activationCost.trim() : '',
    activationByRank: data.character === 'aktywna'
      ? {
          1: data.activationByRank[1].trim(),
          2: data.activationByRank[2].trim(),
          3: data.activationByRank[3].trim(),
          4: data.activationByRank[4].trim(),
        }
      : { ...EMPTY_ACTIVATION_BY_RANK },
    resonance: data.resonance.trim(),
    hibernating: data.hibernating,
    updatedAt: serverTimestamp(),
  }
}

export default function MutationsTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)
  const [items, setItems] = useState<HeroMutation[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<MutationFormData>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HeroMutation | null>(null)

  const race = resolveHeroRace(hero.race)
  const vitals = useMemo(
    () => resolveHeroVitals(hero.vitals, hero.attributes, race),
    [hero.vitals, hero.attributes, race],
  )
  const maxContamination = useMemo(
    () => computeVitalMaxes(hero.attributes, race, vitals.mutationPointsMax).contamination,
    [hero.attributes, race, vitals.mutationPointsMax],
  )
  const totalContamination = contaminationTotal(vitals.contamination)
  const dominantTrack = dominantContaminationTrack(vitals.contamination)
  const overMax = totalContamination > maxContamination

  const mutationsRef = collection(db, 'games', gameId, 'heroes', heroId, 'mutations')

  useEffect(() => {
    const unsub = onSnapshot(mutationsRef, (snap) => {
      const next = snap.docs
        .map((d) => normalizeMutation(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      setItems(next)
      setLoading(false)
    })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on hero change
  }, [gameId, heroId])

  async function handleContaminationTrackChange(track: ContaminationTrack, value: number) {
    const contamination: HeroContamination = {
      ...vitals.contamination,
      [track]: Math.max(0, Math.trunc(value)),
    }
    const next = { ...vitals, contamination }
    await updateField('vitals', t(`vitals.tracks.${track}`), next, vitals)
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await addDoc(mutationsRef, {
        ...toPayload(form),
        sortOrder: items.length,
        createdAt: serverTimestamp(),
      })
      setAdding(false)
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!editingId || !form.name.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(mutationsRef, editingId), toPayload(form))
      setEditingId(null)
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteDoc(doc(mutationsRef, deleteTarget.id))
    setDeleteTarget(null)
  }

  async function handleToggleHibernating(item: HeroMutation) {
    await updateDoc(doc(mutationsRef, item.id), {
      hibernating: !item.hibernating,
      updatedAt: serverTimestamp(),
    })
  }

  function startEdit(item: HeroMutation) {
    setAdding(false)
    setEditingId(item.id)
    setForm({
      name: item.name,
      origin: item.origin,
      kind: item.kind,
      character: item.character,
      rank: item.rank,
      description: item.description,
      atuty: item.atuty.length ? item.atuty : [],
      wady: item.wady.length ? item.wady : [],
      activationCost: item.activationCost,
      activationByRank: { ...item.activationByRank },
      resonance: item.resonance,
      hibernating: item.hibernating,
    })
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
            {t('mutations.title')}
          </h2>
          <p className="text-xs text-ink-faint mt-1 max-w-xl leading-relaxed">
            {t('mutations.subtitle')}
          </p>
        </div>
        <a
          href={MUTATIONS_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blood-light hover:text-blood transition-colors"
        >
          {t('vitals.readMore')}
        </a>
      </div>

      {/* Contamination */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('mutations.contaminationSection')}
        </h3>
        <p className="text-xs text-ink-faint leading-relaxed">
          {t('mutations.contaminationHint')}
        </p>

        <div className={`rounded-lg border p-4 ${
          overMax
            ? 'border-blood/40 bg-blood/5'
            : 'border-border bg-surface'
        }`}>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-[7rem]">
              <p className="text-xs text-ink-muted">{t('mutations.contaminationTotal')}</p>
              <p className="font-mono text-2xl text-ink tabular-nums">
                {totalContamination}
                <span className="text-ink-faint text-base"> / {maxContamination}</span>
              </p>
            </div>

            <div className="min-w-[6rem]">
              <p className="text-xs text-ink-muted">{t('mutations.dominantTrack')}</p>
              {dominantTrack ? (
                <p className="text-sm text-ink font-mono inline-flex items-center gap-1.5">
                  <img
                    src={contaminationIconSrc(dominantTrack)}
                    alt=""
                    className="w-5 h-5 object-contain"
                    aria-hidden
                  />
                  {t(`vitals.tracks.${dominantTrack}`)}
                </p>
              ) : (
                <p className="text-sm text-ink-faint font-mono">{t('mutations.dominantTrackNone')}</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-x-5 gap-y-3 ml-auto">
              {CONTAMINATION_TRACKS.map((track) => (
                <div key={track} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-ink-muted inline-flex items-center gap-1.5">
                    <img
                      src={contaminationIconSrc(track)}
                      alt=""
                      className="w-6 h-6 object-contain shrink-0"
                      aria-hidden
                    />
                    {t(`vitals.tracks.${track}`)}
                  </span>
                  {canEdit ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleContaminationTrackChange(track, vitals.contamination[track] - 1)}
                        className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
                        aria-label={`${t('mechanics.decrease')} ${t(`vitals.tracks.${track}`)}`}
                      >
                        −
                      </button>
                      <span className="font-mono text-lg text-ink tabular-nums w-6 text-center">
                        {vitals.contamination[track]}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleContaminationTrackChange(track, vitals.contamination[track] + 1)}
                        className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
                        aria-label={`${t('mechanics.increase')} ${t(`vitals.tracks.${track}`)}`}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-lg text-ink tabular-nums">
                      {vitals.contamination[track]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {overMax && (
            <p className="text-xs text-blood leading-relaxed mt-3">{t('mutations.contaminationOver')}</p>
          )}
        </div>
      </section>

      {/* Mutations list */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('mutations.mutationsSection')}
        </h3>

        {items.length === 0 && !adding && (
          <p className="text-ink-faint text-sm py-6 text-center">{t('mutations.empty')}</p>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            editingId === item.id ? (
              <MutationForm
                key={item.id}
                mode="edit"
                data={form}
                onChange={setForm}
                onSubmit={() => void handleUpdate()}
                onCancel={() => {
                  setEditingId(null)
                  setForm(EMPTY_FORM)
                }}
                submitLabel={t('common.save')}
                saving={saving}
              />
            ) : (
              <MutationCard
                key={item.id}
                item={item}
                readOnly={!canEdit}
                onEdit={() => startEdit(item)}
                onDelete={() => setDeleteTarget(item)}
                onToggleHibernating={() => void handleToggleHibernating(item)}
              />
            )
          ))}
        </div>

        {canEdit && adding && (
          <MutationForm
            mode="add"
            data={form}
            onChange={setForm}
            onSubmit={() => void handleCreate()}
            onCancel={() => {
              setAdding(false)
              setForm(EMPTY_FORM)
            }}
            submitLabel={t('mutations.add')}
            saving={saving}
          />
        )}

        {canEdit && !adding && !editingId && (
          <Button
            variant="outline"
            onClick={() => {
              setForm(EMPTY_FORM)
              setAdding(true)
            }}
          >
            {t('mutations.add')}
          </Button>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        message={t('mutations.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        dangerous
      />
    </div>
  )
}
