import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

export default function CreateGame() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim() || !user) return
    setLoading(true)
    setError('')
    try {
      const inviteToken = crypto.randomUUID()
      const gameRef = await addDoc(collection(db, 'games'), {
        title: title.trim(),
        description: description.trim(),
        masterId: user.uid,
        inviteToken,
        createdAt: serverTimestamp(),
      })

      // Add creator as GM member
      await setDoc(doc(db, 'games', gameRef.id, 'members', user.uid), {
        uid: user.uid,
        role: 'gm',
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        joinedAt: serverTimestamp(),
      })

      navigate(`/game/${gameRef.id}`)
    } catch {
      setError(t('errors.generic'))
      setLoading(false)
    }
  }

  return (
    <AppLayout backTo="/dashboard" backLabel={t('dashboard.title')}>
      <div className="max-w-md">
        <h1 className="font-heading text-2xl text-ink mb-6">{t('game.createTitle')}</h1>

        <div className="space-y-4">
          <Input
            label={t('game.titleLabel')}
            placeholder={t('game.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            label={t('game.descriptionLabel')}
            placeholder={t('game.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && <p className="text-blood text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCreate}
              loading={loading}
              disabled={!title.trim()}
            >
              {t('game.createButton')}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
