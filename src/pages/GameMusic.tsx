import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { useGameRole } from '@/hooks/useGameRole'
import Spinner from '@/components/ui/Spinner'
import type { Game } from '@/types'

export default function GameMusic() {
  const { gameId = '' } = useParams()
  const { t } = useTranslation()
  const { role, loading: roleLoading } = useGameRole(gameId)
  const isGm = role === 'gm'

  const [game, setGame] = useState<Game | null>(null)
  const [loadingGame, setLoadingGame] = useState(true)

  useLayoutHeader({
    backTo: `/game/${gameId}/gm`,
    backLabel: t('gmPanel.title'),
    title: t('music.title'),
  }, [gameId, t])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoadingGame(false)
    })
    return unsub
  }, [gameId])

  if (loadingGame || roleLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isGm) {
    return (
      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-ink-muted">{t('music.unauthorized')}</p>
        <Link to={`/game/${gameId}`} className="text-sm text-blood-light hover:underline">
          ← {t('game.lobby')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-ink-faint leading-relaxed">{t('music.pageHint')}</p>
      {game && (
        <p className="text-xs font-mono text-ink-faint">{game.title}</p>
      )}
    </div>
  )
}
