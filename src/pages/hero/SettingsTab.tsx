import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { MUTATIONS_DOC_URL, RACES, SHEET_VERSION, type HeroRace } from '@/config/rpg-system'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import { heroFullName, type HeroContamination } from '@/types'
import { migrateHeroSheet } from '@/utils/migrateHeroSheet'
import { needsSheetMigration, resolveHeroSheetVersion } from '@/utils/sheetVersion'
import {
  adjustVitalsForMaxChange,
  clampVital,
  computeVitalMaxes,
  contaminationTotal,
  resolveHeroRace,
  resolveHeroVitals,
  type ContaminationTrack,
} from '@/utils/vitals'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const CONTAMINATION_TRACKS: ContaminationTrack[] = ['deathNet', 'liveCore', 'anomalie']

export default function SettingsTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { gameId: paramGameId = gameId } = useParams()
  const { updateField } = useHeroField(gameId, heroId)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateError, setMigrateError] = useState('')

  const heroVersion = resolveHeroSheetVersion(hero.sheetVersion)
  const needsMigration = needsSheetMigration(hero.sheetVersion)
  const heroName = heroFullName(hero)
  const race = resolveHeroRace(hero.race)
  const vitals = useMemo(
    () => resolveHeroVitals(hero.vitals, hero.attributes, race),
    [hero.vitals, hero.attributes, race],
  )
  const maxContamination = computeVitalMaxes(
    hero.attributes,
    race,
    vitals.mutationPointsMax,
  ).contamination

  async function handleDelete() {
    await deleteDoc(doc(db, 'games', paramGameId, 'heroes', heroId))
    navigate(`/game/${paramGameId}`)
  }

  async function handleMigrate() {
    setMigrating(true)
    setMigrateError('')
    try {
      await migrateHeroSheet(paramGameId, heroId, hero)
      setMigrateOpen(false)
    } catch {
      setMigrateError(t('hero.settings.migrateError'))
    } finally {
      setMigrating(false)
    }
  }

  async function handleRaceChange(nextRace: HeroRace) {
    const oldMax = computeVitalMaxes(hero.attributes, race, vitals.mutationPointsMax)
    const newMax = computeVitalMaxes(hero.attributes, nextRace, vitals.mutationPointsMax)
    const nextVitals = adjustVitalsForMaxChange(vitals, oldMax, newMax)
    await updateField('race', t('vitals.race'), nextRace, race)
    if (
      nextVitals.hp !== vitals.hp
      || nextVitals.fatigue !== vitals.fatigue
      || nextVitals.stress !== vitals.stress
    ) {
      await updateField('vitals', t('vitals.title'), nextVitals, vitals)
    }
  }

  async function handleMutationMaxChange(nextMax: number) {
    const mutationPointsMax = Math.max(0, Math.trunc(nextMax))
    const next = {
      ...vitals,
      mutationPointsMax,
      mutationPoints: clampVital(vitals.mutationPoints, mutationPointsMax),
    }
    await updateField('vitals', t('vitals.mutationPointsMax'), next, vitals)
  }

  async function handleContaminationTrackChange(track: ContaminationTrack, value: number) {
    const contamination: HeroContamination = {
      ...vitals.contamination,
      [track]: Math.max(0, Math.trunc(value)),
    }
    const next = { ...vitals, contamination }
    await updateField('vitals', t(`vitals.tracks.${track}`), next, vitals)
  }

  if (!canEdit) {
    return (
      <p className="text-ink-faint text-sm text-center py-8">{t('errors.unauthorized')}</p>
    )
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* Race */}
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('vitals.race')}
        </h2>
        <p className="text-xs text-ink-faint leading-relaxed">
          {t('hero.settings.raceHint')}
        </p>
        <select
          value={race}
          onChange={(e) => void handleRaceChange(e.target.value as HeroRace)}
          className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-blood/50"
        >
          {RACES.map((r) => (
            <option key={r.key} value={r.key}>
              {t(r.labelKey)} (+{r.hpBonus} {t('vitals.short.hp')})
            </option>
          ))}
        </select>
      </section>

      {/* Mutation points max */}
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('vitals.mutationPoints')}
        </h2>
        <p className="text-xs text-ink-faint leading-relaxed">
          {t('hero.settings.mutationPointsMaxHint')}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">{t('vitals.mutationPointsMax')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleMutationMaxChange(vitals.mutationPointsMax - 1)}
              className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
              aria-label={t('mechanics.decrease')}
            >
              −
            </button>
            <span className="font-mono text-lg text-ink tabular-nums w-8 text-center">
              {vitals.mutationPointsMax}
            </span>
            <button
              type="button"
              onClick={() => void handleMutationMaxChange(vitals.mutationPointsMax + 1)}
              className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
              aria-label={t('mechanics.increase')}
            >
              +
            </button>
          </div>
        </div>
        <a
          href={MUTATIONS_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blood-light hover:text-blood transition-colors"
        >
          {t('vitals.readMore')}
        </a>
      </section>

      {/* Contamination tracks */}
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('vitals.contamination')}
        </h2>
        <p className="text-xs text-ink-faint leading-relaxed">
          {t('hero.settings.contaminationHint', {
            total: contaminationTotal(vitals.contamination),
            max: maxContamination,
          })}
        </p>
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {CONTAMINATION_TRACKS.map((track) => (
            <div key={track} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-void/40">
              <span className="text-sm text-ink-muted">{t(`vitals.tracks.${track}`)}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleContaminationTrackChange(track, vitals.contamination[track] - 1)}
                  className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
                  aria-label={t('mechanics.decrease')}
                >
                  −
                </button>
                <span className="font-mono text-lg text-ink tabular-nums w-8 text-center">
                  {vitals.contamination[track]}
                </span>
                <button
                  type="button"
                  onClick={() => void handleContaminationTrackChange(track, vitals.contamination[track] + 1)}
                  className="w-6 h-6 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-sm"
                  aria-label={t('mechanics.increase')}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sheet version */}
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('hero.settings.versionTitle')}
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink">
              {t('hero.settings.currentVersion')}{' '}
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                needsMigration
                  ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                  : 'text-ink-faint border-border'
              }`}>
                v{heroVersion}
              </span>
            </p>
            <p className="text-xs text-ink-faint mt-1">
              {t('hero.settings.latestVersion')}{' '}
              <span className="font-mono">v{SHEET_VERSION}</span>
            </p>
          </div>
          {needsMigration && (
            <Button
              variant="outline"
              loading={migrating}
              onClick={() => {
                setMigrateError('')
                setMigrateOpen(true)
              }}
              className="text-xs border-amber-400/40 text-amber-300 hover:bg-amber-400/10 shrink-0"
            >
              {t('hero.migrateSheet', { latest: SHEET_VERSION })}
            </Button>
          )}
        </div>
        {needsMigration && (
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {t('hero.versionOutdated', { current: heroVersion, latest: SHEET_VERSION })}
          </p>
        )}
        {needsMigration && (
          <p className="text-xs text-ink-faint leading-relaxed">
            {t('hero.settings.migrateBackupHint')}
          </p>
        )}
        {migrateError && (
          <p className="text-xs text-blood leading-relaxed">{migrateError}</p>
        )}
      </section>

      {/* Danger zone */}
      <section className="bg-surface border border-blood/20 rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood tracking-widest uppercase">
          {t('hero.settings.dangerZone')}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink">{t('hero.deleteHero')}</p>
            <p className="text-xs text-ink-faint mt-0.5">{t('hero.settings.deleteHint')}</p>
          </div>
          <Button
            variant="danger"
            className="text-xs shrink-0"
            onClick={() => setDeleteOpen(true)}
          >
            {t('hero.deleteHero')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={migrateOpen}
        message={t('hero.migrateConfirm', { current: heroVersion, latest: SHEET_VERSION })}
        onConfirm={handleMigrate}
        onCancel={() => setMigrateOpen(false)}
        confirmLoading={migrating}
      />

      <ConfirmDialog
        open={deleteOpen}
        message={t('hero.deleteConfirm', { name: heroName })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        dangerous
      />
    </div>
  )
}
