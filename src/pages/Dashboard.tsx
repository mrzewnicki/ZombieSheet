import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  collection, query, where, onSnapshot, getDocs, collectionGroup,
  doc, deleteDoc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import type { Game } from '@/types'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface GameWithMeta extends Game {
  isGm: boolean
  memberCount: number
  heroCount: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [games, setGames] = useState<GameWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<GameWithMeta | null>(null)
  useLayoutHeader({}, [])

  useEffect(() => {
    if (!user) return

    // Listen to all games where user is a member
    const membersQuery = query(
      collectionGroup(db, 'members'),
      where('uid', '==', user.uid)
    )

    const unsub = onSnapshot(membersQuery, async (snap) => {
      const results: GameWithMeta[] = []

      await Promise.all(
        snap.docs.map(async (memberDoc) => {
          const gameId = memberDoc.ref.parent.parent?.id
          if (!gameId) return

          // Get game doc
          const gameSnap = await getDocs(
            query(collection(db, 'games'), where('__name__', '==', gameId))
          )
          if (gameSnap.empty) return
          const gameData = { id: gameId, ...gameSnap.docs[0].data() } as Game

          // Count members and heroes
          const [membersSnap, heroesSnap] = await Promise.all([
            getDocs(collection(db, 'games', gameId, 'members')),
            getDocs(collection(db, 'games', gameId, 'heroes')),
          ])

          results.push({
            ...gameData,
            isGm: gameData.masterId === user.uid,
            memberCount: membersSnap.size,
            heroCount: heroesSnap.size,
          })
        })
      )

      results.sort(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      )
      setGames(results)
      setLoading(false)
    })

    return unsub
  }, [user])

  async function handleDelete() {
    if (!pendingDelete) return
    const game = pendingDelete
    setPendingDelete(null)
    await deleteDoc(doc(db, 'games', game.id))
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-ink">{t('dashboard.title')}</h1>
        <Link to="/game/new">
          <Button>{t('dashboard.createGame')}</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-ink-muted">{t('dashboard.noGames')}</p>
          <p className="text-ink-faint text-sm">{t('dashboard.noGamesHint')}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <Link
              key={game.id}
              to={`/game/${game.id}`}
              className="block bg-surface border border-border hover:border-blood/50 rounded-lg p-5 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="font-heading text-lg text-ink group-hover:text-blood-light transition-colors leading-tight">
                  {game.title}
                </h2>
                <span
                  className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    game.isGm
                      ? 'text-blood border-blood/40 bg-blood/10'
                      : 'text-military border-military/40 bg-military/10'
                  }`}
                >
                  {game.isGm ? t('game.gmBadge') : t('dashboard.rolePlayer')}
                </span>
              </div>

              {game.description && (
                <p className="text-ink-faint text-xs mb-4 line-clamp-2 leading-relaxed">
                  {game.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-ink-faint font-mono">
                <div className="flex gap-4">
                  <span>{t('dashboard.members', { count: game.memberCount })}</span>
                  <span>{t('dashboard.heroes', { count: game.heroCount })}</span>
                </div>
                {game.isGm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPendingDelete(game)
                    }}
                    className="text-ink-faint hover:text-blood transition-colors"
                    title={t('game.deleteGame')}
                  >
                    {t('game.deleteGame')}
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={t('game.deleteConfirm', { title: pendingDelete?.title ?? '' })}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        dangerous
      />
    </>
  )
}
