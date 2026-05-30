import { useEffect, useRef, useState } from 'react'
import { useParams, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useCanEdit } from '@/hooks/useCanEdit'
import { SHEET_VERSION } from '@/config/rpg-system'
import { heroFullName, type Hero } from '@/types'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import Spinner from '@/components/ui/Spinner'

export default function HeroSheet() {
  const { gameId = '', heroId = '' } = useParams()
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const activeTab = pathname.split('/').pop() ?? ''
  const [hero, setHero] = useState<Hero | null>(null)
  const [loading, setLoading] = useState(true)

  const canEdit = useCanEdit(gameId, hero?.ownerId ?? '')
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector('[aria-current="page"]') as HTMLElement | null
    if (!active) return
    const navRect = nav.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    setIndicator({ left: activeRect.left - navRect.left, width: activeRect.width, ready: true })
  }, [activeTab])
  const heroName = hero ? heroFullName(hero, '...') : '...'

  useLayoutHeader({
    backTo: `/game/${gameId}`,
    backLabel: t('game.lobby'),
    title: heroName,
    actions: !canEdit ? (
      <span className="text-xs text-ink-faint border border-border px-2 py-1 rounded font-mono">
        {t('common.readOnly')}
      </span>
    ) : undefined,
  }, [gameId, heroName, canEdit, t])

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

  const tabs = [
    { key: 'personal',  label: t('hero.tabs.personal'),  icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm5 5c0 1-1 1-1 1H4s-1 0-1-1 1-4 5-4 5 3 5 4z"/></svg> },
    { key: 'mechanics', label: t('hero.tabs.mechanics'), icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M13 1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10zM3 0a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3H3z"/><path d="M5.5 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm8 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-8 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm4-4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg> },
    { key: 'inventory', label: t('hero.tabs.inventory'), icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg> },
    { key: 'images',    label: t('hero.tabs.images'),    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg> },
  ]

  const historyIcon = <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.025 8.025 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z"/><path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/><path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/></svg>

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  if (!hero) {
    return <p className="text-blood">{t('errors.notFound')}</p>
  }

  return (
    <>
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
      <nav ref={navRef} className="relative flex border-b border-border mb-6 gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={`/game/${gameId}/hero/${heroId}/${tab.key}`}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
                isActive ? 'text-ink font-medium' : 'text-ink/60 hover:text-ink'
              }`
            }
          >
            <span className="relative -top-[2px]">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
        <NavLink
          to={`/game/${gameId}/hero/${heroId}/history`}
          className={({ isActive }) =>
            `ml-auto flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              isActive ? 'text-ink font-medium' : 'text-ink/60 hover:text-ink'
            }`
          }
        >
          <span className="relative -top-[2px]">{historyIcon}</span>
          {t('hero.tabs.history')}
        </NavLink>
        {canEdit && (
          <NavLink
            to={`/game/${gameId}/hero/${heroId}/settings`}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
                isActive ? 'text-ink font-medium' : 'text-ink/60 hover:text-ink'
              }`
            }
          >
            <span className="relative -top-[2px]"><svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/></svg></span>
            {t('hero.tabs.settings')}
          </NavLink>
        )}
        {indicator.ready && (
          <span
            className="absolute bottom-0 h-0.5 bg-blood"
            style={{
              left: indicator.left,
              width: indicator.width,
              transition: 'left 200ms ease, width 200ms ease',
            }}
          />
        )}
      </nav>

      {/* Tab content rendered by nested routes */}
      <div key={activeTab} className="tab-enter">
        <Outlet context={{ hero, gameId, heroId, canEdit }} />
      </div>

    </>
  )
}
