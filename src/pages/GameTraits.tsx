import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { useGearTraitCatalog } from '@/hooks/useGearTraitCatalog'
import type { Game, GearTraitChange } from '@/types'
import { GEAR_TRAIT_CHANGES_COLLECTION } from '@/utils/gearTraitCatalog'
import TraitsTable from '@/components/traits/TraitsTable'
import TraitChangeHistory from '@/components/traits/TraitChangeHistory'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function GameTraits() {
  const { gameId = '' } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [game, setGame] = useState<Game | null>(null)
  const [changes, setChanges] = useState<GearTraitChange[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingGame, setLoadingGame] = useState(true)
  const { traits, loading: traitsLoading, error: traitsError } = useGearTraitCatalog(gameId)

  useLayoutHeader({
    backTo: `/game/${gameId}`,
    backLabel: game?.title ?? t('dashboard.title'),
    title: t('traitsCatalog.title'),
  }, [game?.title, gameId, t])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoadingGame(false)
    })
    return unsub
  }, [gameId])

  useEffect(() => {
    if (!historyOpen) return

    setLoadingHistory(true)
    const q = query(
      collection(db, 'games', gameId, GEAR_TRAIT_CHANGES_COLLECTION),
      orderBy('changedAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setChanges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearTraitChange)))
        setLoadingHistory(false)
      },
      () => setLoadingHistory(false),
    )
    return unsub
  }, [gameId, historyOpen])

  if (loadingGame || traitsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl text-ink">{t('traitsCatalog.title')}</h1>
        {game && (
          <p className="text-ink-muted text-sm mt-1">{game.title}</p>
        )}
        <p className="text-ink-faint text-xs mt-2 leading-relaxed max-w-2xl">
          {t('traitsCatalog.hint')}
        </p>
      </div>

      {traitsError && (
        <p className="text-sm text-blood">{traitsError}</p>
      )}

      <TraitsTable
        gameId={gameId}
        catalog={traits}
        authorUid={user.uid}
        authorName={user.displayName || user.email || t('traitsCatalog.unknownUser')}
      />

      <section>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
            {t('traitsCatalog.changeLog')}
          </h2>
          {!historyOpen && (
            <Button variant="ghost" onClick={() => setHistoryOpen(true)}>
              {t('traitsCatalog.loadHistory')}
            </Button>
          )}
        </div>
        {historyOpen && (
          loadingHistory ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <TraitChangeHistory changes={changes} />
          )
        )}
      </section>
    </div>
  )
}
