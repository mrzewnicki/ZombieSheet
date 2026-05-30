import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { SHEET_VERSION, DEFAULT_ATTRIBUTES, DEFAULT_SKILLS } from '@/config/rpg-system'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import { heroFullName } from '@/types'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function SettingsTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { gameId: paramGameId = gameId } = useParams()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const heroVersion = hero.sheetVersion ?? 0
  const needsMigration = heroVersion !== SHEET_VERSION
  const heroName = heroFullName(hero)

  async function handleDelete() {
    await deleteDoc(doc(db, 'games', paramGameId, 'heroes', heroId))
    navigate(`/game/${paramGameId}`)
  }

  async function handleMigrate() {
    setMigrating(true)
    try {
      await updateDoc(doc(db, 'games', paramGameId, 'heroes', heroId), {
        attributes: { ...DEFAULT_ATTRIBUTES, ...hero.attributes },
        skills: { ...DEFAULT_SKILLS, ...hero.skills },
        sheetVersion: SHEET_VERSION,
        updatedAt: serverTimestamp(),
      })
    } finally {
      setMigrating(false)
    }
  }

  if (!canEdit) {
    return (
      <p className="text-ink-faint text-sm text-center py-8">{t('errors.unauthorized')}</p>
    )
  }

  return (
    <div className="max-w-lg space-y-6">

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
              onClick={handleMigrate}
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
        open={deleteOpen}
        message={t('hero.deleteConfirm', { name: heroName })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        dangerous
      />
    </div>
  )
}
