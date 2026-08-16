import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import CampaignNpcsPanel from '@/components/campaign/CampaignNpcsPanel'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { useCampaignNpcs } from '@/hooks/useCampaignNpcs'
import { useGameRole } from '@/hooks/useGameRole'
import type { Game } from '@/types'

export default function GameNpcs() {
  const { gameId = '' } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { role, loading: roleLoading } = useGameRole(gameId)
  const canEdit = role === 'gm'
  const isGm = role === 'gm'
  const [game, setGame] = useState<Game | null>(null)
  const [loadingGame, setLoadingGame] = useState(true)
  const { npcs, loading: npcsLoading, error } = useCampaignNpcs(gameId)

  useLayoutHeader({
    backTo: `/game/${gameId}`,
    backLabel: game?.title ?? t('dashboard.title'),
    title: isGm ? t('campaignNpcs.gmPanelTitle') : t('campaignNpcs.title'),
  }, [game?.title, gameId, isGm, t])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoadingGame(false)
    })
    return unsub
  }, [gameId])

  if (loadingGame || npcsLoading || roleLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-ink-faint">
        {isGm ? t('campaignNpcs.gmPageHint') : t('campaignNpcs.pageHint')}
      </p>
      {error && <p className="text-sm text-blood">{error}</p>}
      <CampaignNpcsPanel gameId={gameId} npcs={npcs} canEdit={canEdit} />
      {!isGm && (
        <p className="text-xs text-ink-faint">{t('campaignNpcs.playerReadOnly')}</p>
      )}
      <p className="text-xs text-ink-faint">
        {t('campaignNpcs.relationsHint')}{' '}
        <Link to={`/game/${gameId}`} className="text-blood-light hover:underline">
          {t('game.lobby')}
        </Link>
      </p>
    </div>
  )
}
