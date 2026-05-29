import { useEffect, useState } from 'react'
import { useParams, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useCanEdit } from '@/hooks/useCanEdit'
import { SHEET_VERSION } from '@/config/rpg-system'
import type { Hero } from '@/types'
import AppLayout from '@/components/layout/AppLayout'
import Spinner from '@/components/ui/Spinner'

export default function HeroSheet() {
  const { gameId = '', heroId = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [hero, setHero] = useState<Hero | null>(null)
  const [loading, setLoading] = useState(true)

  const canEdit = useCanEdit(gameId, hero?.ownerId ?? '')

  useEffect(() => {
    const heroRef = doc(db, 'games', gameId, 'heroes', heroId)
    const unsub = onSnapshot(heroRef, (snap) => {
      if (snap.exists()) setHero({ id: snap.id, ...snap.data() } as Hero)
      setLoading(false)
    })
    return unsub
  }, [gameId, heroId])

  const heroVersion = hero?.sheetVersion ?? 0
  const needsMigration = heroVersion !== SHEET_VERSION

  const heroName = hero ? [hero.name, hero.surname].filter(Boolean).join(' ') : '...'

  const tabs = [
    { key: 'personal',  label: t('hero.tabs.personal') },
    { key: 'mechanics', label: t('hero.tabs.mechanics') },
    { key: 'inventory', label: t('hero.tabs.inventory') },
    { key: 'images',    label: t('hero.tabs.images') },
    { key: 'history',   label: t('hero.tabs.history') },
    ...(canEdit ? [{ key: 'settings', label: t('hero.tabs.settings') }] : []),
  ]

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </AppLayout>
    )
  }

  if (!hero) {
    return <AppLayout><p className="text-blood">{t('errors.notFound')}</p></AppLayout>
  }

  return (
    <AppLayout
      backTo={`/game/${gameId}`}
      backLabel={t('game.lobby')}
      title={heroName}
      actions={
        !canEdit ? (
          <span className="text-xs text-ink-faint border border-border px-2 py-1 rounded font-mono">
            {t('common.readOnly')}
          </span>
        ) : undefined
      }
    >
      {/* Hero header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-lg border border-border overflow-hidden bg-void flex items-center justify-center shrink-0">
          {hero.imageURL ? (
            <img src={hero.imageURL} alt={heroName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-ink-faint text-2xl">☠</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl text-ink">{heroName}</h1>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                needsMigration
                  ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                  : 'text-ink-faint border-border'
              }`}
              title={needsMigration
                ? t('hero.versionOutdatedTitle', { current: heroVersion, latest: SHEET_VERSION })
                : t('hero.versionCurrentTitle', { version: SHEET_VERSION })
              }
            >
              v{heroVersion}
            </span>
          </div>
          {!canEdit && (
            <p className="text-xs text-ink-faint mt-0.5">{t('common.readOnly')}</p>
          )}
        </div>
      </div>

      {/* Outdated version hint — full action in Settings tab */}
      {needsMigration && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <span className="text-amber-400 text-sm">⚠</span>
          <p className="text-sm text-amber-300 flex-1">
            {t('hero.versionOutdated', { current: heroVersion, latest: SHEET_VERSION })}
          </p>
          {canEdit && (
            <NavLink
              to={`/game/${gameId}/hero/${heroId}/settings`}
              className="text-xs font-mono text-amber-300 underline underline-offset-2 hover:text-amber-200 shrink-0"
            >
              {t('hero.tabs.settings')} →
            </NavLink>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <nav className="flex border-b border-border mb-6 gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={`/game/${gameId}/hero/${heroId}/${tab.key}`}
            className={({ isActive }) =>
              `px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-blood text-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* Tab content rendered by nested routes */}
      <div key={location.pathname} className="tab-enter">
        <Outlet context={{ hero, gameId, heroId, canEdit }} />
      </div>

    </AppLayout>
  )
}
