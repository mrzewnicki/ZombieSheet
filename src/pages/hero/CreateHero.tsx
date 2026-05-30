import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_ATTRIBUTES, DEFAULT_SKILLS, SHEET_VERSION } from '@/config/rpg-system'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function CreateHero() {
  const { gameId = '' } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  useLayoutHeader({ backTo: `/game/${gameId}`, backLabel: t('game.lobby') }, [gameId])
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim() || !user) return
    setLoading(true)
    setError('')
    try {
      const heroRef = await addDoc(collection(db, 'games', gameId, 'heroes'), {
        ownerId: user.uid,
        name: name.trim(),
        surname: surname.trim(),
        imageURL: '',
        description: '',
        attributes: { ...DEFAULT_ATTRIBUTES },
        skills: { ...DEFAULT_SKILLS },
        sheetVersion: SHEET_VERSION,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      navigate(`/game/${gameId}/hero/${heroRef.id}/personal`)
    } catch {
      setError(t('errors.generic'))
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm">
        <h1 className="font-heading text-2xl text-ink mb-6">{t('hero.createTitle')}</h1>

        <div className="space-y-4">
          <Input
            label={t('hero.nameLabel')}
            placeholder={t('hero.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input
            label={t('hero.surnameLabel')}
            placeholder={t('hero.surnamePlaceholder')}
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />

          {error && <p className="text-blood text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
              {t('hero.createButton')}
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/game/${gameId}`)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
    </div>
  )
}
