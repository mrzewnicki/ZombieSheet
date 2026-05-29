import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

type Status = 'checking' | 'ready' | 'already' | 'invalid' | 'joining' | 'done'

export default function JoinGame() {
  const { gameId = '', token = '' } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [gameTitle, setGameTitle] = useState('')

  useEffect(() => {
    async function check() {
      const gameSnap = await getDoc(doc(db, 'games', gameId))
      if (!gameSnap.exists() || gameSnap.data().inviteToken !== token) {
        setStatus('invalid')
        return
      }
      setGameTitle(gameSnap.data().title)

      if (!user) { setStatus('ready'); return }

      const memberSnap = await getDoc(doc(db, 'games', gameId, 'members', user.uid))
      if (memberSnap.exists()) {
        setStatus('already')
      } else {
        setStatus('ready')
      }
    }
    check()
  }, [gameId, token, user])

  async function handleJoin() {
    if (!user) return
    setStatus('joining')
    await setDoc(doc(db, 'games', gameId, 'members', user.uid), {
      uid: user.uid,
      role: 'player',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      joinedAt: serverTimestamp(),
    })
    setStatus('done')
    setTimeout(() => navigate(`/game/${gameId}`), 800)
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-lg p-8 max-w-sm w-full text-center space-y-6">
        <h1 className="font-heading text-2xl text-ink">{t('game.joinTitle')}</h1>

        {(status === 'checking') && <Spinner size="lg" className="mx-auto" />}

        {status === 'invalid' && (
          <p className="text-blood text-sm">{t('game.invalidToken')}</p>
        )}

        {status === 'already' && (
          <>
            <p className="text-ink-muted text-sm">{t('game.alreadyMember')}</p>
            <Button onClick={() => navigate(`/game/${gameId}`)} className="w-full">
              {t('game.lobby')}
            </Button>
          </>
        )}

        {(status === 'ready') && (
          <>
            <p className="text-ink text-sm">
              <span className="font-heading text-lg text-blood-light">{gameTitle}</span>
            </p>
            <Button onClick={handleJoin} className="w-full">{t('game.joinButton')}</Button>
          </>
        )}

        {status === 'joining' && <Spinner size="lg" className="mx-auto" />}

        {status === 'done' && (
          <p className="text-ink-muted text-sm">{t('game.joining')}</p>
        )}
      </div>
    </div>
  )
}
