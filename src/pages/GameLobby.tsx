import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  doc, collection, onSnapshot, deleteDoc, updateDoc,
  query, orderBy,
} from 'firebase/firestore'
import { memberLabel } from '@/types'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useGameRole } from '@/hooks/useGameRole'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import type { Game, GameMember, Hero } from '@/types'
import HeroCard from '@/components/hero/HeroCard'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Avatar from '@/components/ui/Avatar'

export default function GameLobby() {
  const { gameId = '' } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { role, loading: roleLoading } = useGameRole(gameId)
  const navigate = useNavigate()

  const [game, setGame] = useState<Game | null>(null)
  const [members, setMembers] = useState<GameMember[]>([])
  const [heroes, setHeroes] = useState<Hero[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [editingNick, setEditingNick] = useState<string | null>(null)
  const [nickDraft, setNickDraft] = useState('')

  const isGm = role === 'gm'

  useLayoutHeader({
    backTo: '/dashboard',
    backLabel: t('dashboard.title'),
    title: game?.title,
    actions: isGm ? (
      <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-xs text-ink-faint hover:text-blood">
        {t('game.deleteGame')}
      </Button>
    ) : undefined,
  }, [game?.title, isGm, t])

  useEffect(() => {
    const gameRef = doc(db, 'games', gameId)
    const unsubGame = onSnapshot(gameRef, (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoading(false)
    })

    const unsubMembers = onSnapshot(
      collection(db, 'games', gameId, 'members'),
      (snap) => setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GameMember)))
    )

    const heroQ = query(collection(db, 'games', gameId, 'heroes'), orderBy('createdAt', 'desc'))
    const unsubHeroes = onSnapshot(heroQ, (snap) =>
      setHeroes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Hero)))
    )

    return () => { unsubGame(); unsubMembers(); unsubHeroes() }
  }, [gameId])

  function getInviteUrl() {
    return `${window.location.origin}/game/${gameId}/invite/${game?.inviteToken}`
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

  async function handleDelete() {
    await deleteDoc(doc(db, 'games', gameId))
    navigate('/dashboard')
  }

  function startEditNick(m: GameMember) {
    setEditingNick(m.uid)
    setNickDraft(m.nick ?? '')
  }

  async function saveNick(uid: string) {
    const trimmed = nickDraft.trim()
    await updateDoc(doc(db, 'games', gameId, 'members', uid), {
      nick: trimmed || null,
    })
    setEditingNick(null)
  }

  function getMemberForHero(hero: Hero): GameMember | undefined {
    return members.find((m) => m.uid === hero.ownerId)
  }

  if (loading || roleLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  if (!game) {
    return <p className="text-blood">{t('errors.notFound')}</p>
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl text-ink">{game.title}</h1>
          {game.description && (
            <p className="text-ink-muted mt-1 text-sm leading-relaxed">{game.description}</p>
          )}
        </div>

        {/* Members */}
        <section>
          <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-3">
            {t('game.members')}
          </h2>
          <div className="flex flex-wrap gap-3">
            {members.map((m) => {
              const canEditNick = isGm || m.uid === user?.uid
              const isEditing = editingNick === m.uid
              return (
                <div
                  key={m.uid}
                  className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 group/chip"
                >
                  <Avatar src={m.photoURL} name={memberLabel(m)} className="w-6 h-6 shrink-0" />

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNick(m.uid)
                          if (e.key === 'Escape') setEditingNick(null)
                        }}
                        placeholder={m.displayName}
                        className="bg-void border border-blood/50 rounded px-2 py-0.5 text-sm text-ink focus:outline-none focus:border-blood w-32"
                      />
                      <button onClick={() => saveNick(m.uid)} className="text-blood hover:text-blood-light text-xs font-mono">✓</button>
                      <button onClick={() => setEditingNick(null)} className="text-ink-faint hover:text-ink text-xs font-mono">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-ink">{memberLabel(m)}</span>
                      {m.nick && (
                        <span className="text-[10px] text-ink-faint font-mono hidden group-hover/chip:inline">
                          ({m.displayName})
                        </span>
                      )}
                      {canEditNick && (
                        <button
                          onClick={() => startEditNick(m)}
                          className="text-ink-faint hover:text-blood text-[10px] opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5"
                          title={t('game.editNick')}
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}

                  {m.role === 'gm' && (
                    <span className="text-[10px] font-mono text-blood border border-blood/40 px-1 rounded shrink-0">
                      {t('game.gmBadge')}
                    </span>
                  )}
                  {isGm && m.uid !== user?.uid && (
                    <button
                      onClick={async () => {
                        await deleteDoc(doc(db, 'games', gameId, 'members', m.uid))
                      }}
                      className="ml-1 text-ink-faint hover:text-blood text-xs"
                      title={t('game.removePlayer')}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Invite link — GM only */}
        {isGm && (
          <section>
            <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-3">
              {t('game.invite')}
            </h2>
            <p className="text-xs text-ink-faint mb-2">{t('game.inviteHint')}</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={copyLink} className="text-xs">
                {copied ? t('common.copied') : t('game.copyLink')}
              </Button>
              <Button variant="ghost" onClick={regenerateToken} loading={regenerating} className="text-xs">
                {t('game.regenerateLink')}
              </Button>
            </div>
            <p className="mt-2 font-mono text-ink-faint text-[11px] break-all">{getInviteUrl()}</p>
          </section>
        )}

        {/* Heroes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
              {t('game.heroes')}
            </h2>
            <Link to={`/game/${gameId}/hero/new`}>
              <Button className="text-xs py-1.5">{t('game.createHero')}</Button>
            </Link>
          </div>

          {heroes.length === 0 ? (
            <p className="text-ink-faint text-sm">{t('game.noHeroes')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {heroes.map((hero) => (
                <HeroCard
                  key={hero.id}
                  gameId={gameId}
                  hero={hero}
                  owner={getMemberForHero(hero)}
                  isGm={isGm && hero.ownerId === user?.uid}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        message={t('game.deleteConfirm', { title: game.title })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        dangerous
      />
    </>
  )
}
