import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { InventoryItem } from '@/types'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import InventoryList from '@/components/hero/InventoryList'
import Spinner from '@/components/ui/Spinner'

export default function InventoryTab() {
  const { gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'games', gameId, 'heroes', heroId, 'inventory'),
      orderBy('name')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
      setLoading(false)
    })
    return unsub
  }, [gameId, heroId])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div>
      <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
        {t('inventory.title')}
      </h2>
      <InventoryList
        gameId={gameId}
        heroId={heroId}
        items={items}
        readOnly={!canEdit}
      />
    </div>
  )
}
