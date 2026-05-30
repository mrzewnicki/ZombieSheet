import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { HeroChange } from '@/types'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import ChangeHistory from '@/components/hero/ChangeHistory'
import Spinner from '@/components/ui/Spinner'

export default function HistoryTab() {
  const { gameId, heroId } = useHeroOutletContext()
  const { t } = useTranslation()
  const [changes, setChanges] = useState<HeroChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'games', gameId, 'heroes', heroId, 'changes'),
      orderBy('changedAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setChanges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HeroChange)))
      setLoading(false)
    })
    return unsub
  }, [gameId, heroId])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div>
      <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
        {t('history.title')}
      </h2>
      <ChangeHistory changes={changes} />
    </div>
  )
}
