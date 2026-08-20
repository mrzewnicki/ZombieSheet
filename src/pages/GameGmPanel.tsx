import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { useGameRole } from '@/hooks/useGameRole'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import type { Game } from '@/types'

const linkClass =
  'rounded-lg border border-border bg-elevated/40 px-4 py-4 hover:border-border-light hover:bg-elevated/60 transition-colors group block'

export default function GameGmPanel() {
  const { gameId = '' } = useParams()
  const { t } = useTranslation()
  const { role, loading: roleLoading } = useGameRole(gameId)
  const isGm = role === 'gm'

  const [game, setGame] = useState<Game | null>(null)
  const [loadingGame, setLoadingGame] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useLayoutHeader({
    backTo: `/game/${gameId}`,
    backLabel: game?.title ?? t('dashboard.title'),
    title: t('gmPanel.title'),
  }, [game?.title, gameId, t])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoadingGame(false)
    })
    return unsub
  }, [gameId])

  function getInviteUrl() {
    return `${window.location.origin}${import.meta.env.BASE_URL}game/${gameId}/invite/${game?.inviteToken}`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getInviteUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateToken() {
    setRegenerating(true)
    await updateDoc(doc(db, 'games', gameId), { inviteToken: crypto.randomUUID() })
    setRegenerating(false)
  }

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
        <p className="text-sm text-ink-muted">{t('gmPanel.unauthorized')}</p>
        <Link to={`/game/${gameId}`} className="text-sm text-blood-light hover:underline">
          ← {t('game.lobby')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-ink-faint leading-relaxed">{t('gmPanel.pageHint')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to={`/game/${gameId}/npcs`} className={linkClass}>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-2 group-hover:text-blood">
            {t('campaignNpcs.gmPanelTitle')}
          </h2>
          <p className="text-ink-faint text-sm leading-relaxed">{t('campaignNpcs.gmLobbyHint')}</p>
        </Link>

        <Link to={`/game/${gameId}/traits`} className={linkClass}>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-2 group-hover:text-blood">
            {t('traitsCatalog.title')}
          </h2>
          <p className="text-ink-faint text-sm leading-relaxed">{t('traitsCatalog.lobbyHint')}</p>
        </Link>

        <Link to={`/game/${gameId}/settlement`} className={linkClass}>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-2 group-hover:text-blood">
            {t('settlement.title')}
          </h2>
          <p className="text-ink-faint text-sm leading-relaxed">{t('settlement.lobbyHint')}</p>
        </Link>

        <Link to={`/game/${gameId}/music`} className={linkClass}>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-2 group-hover:text-blood">
            {t('music.title')}
          </h2>
          <p className="text-ink-faint text-sm leading-relaxed">{t('music.lobbyHint')}</p>
        </Link>
      </div>

      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-3">
          {t('game.invite')}
        </h2>
        <p className="text-xs text-ink-faint mb-2">{t('game.inviteHint')}</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => void copyLink()} className="text-xs">
            {copied ? t('common.copied') : t('game.copyLink')}
          </Button>
          <Button variant="ghost" onClick={() => void regenerateToken()} loading={regenerating} className="text-xs">
            {t('game.regenerateLink')}
          </Button>
        </div>
        <p className="mt-2 font-mono text-ink-faint text-[11px] break-all">{getInviteUrl()}</p>
      </section>
    </div>
  )
}
