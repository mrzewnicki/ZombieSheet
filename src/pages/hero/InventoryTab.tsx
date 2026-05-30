import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { InventoryItem, WeaponItem, ArmorItem } from '@/types'
import { normalizeGearVisual } from '@/utils/gearVisual'
import { sortGearListItems } from '@/utils/gearListOrder'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import WeaponList from '@/components/hero/WeaponList'
import ArmorList from '@/components/hero/ArmorList'
import InventoryList from '@/components/hero/InventoryList'
import Spinner from '@/components/ui/Spinner'

export default function InventoryTab() {
  const { gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const [weapons, setWeapons] = useState<WeaponItem[]>([])
  const [armor, setArmor] = useState<ArmorItem[]>([])
  const [equipment, setEquipment] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState({ weapons: true, armor: true, equipment: true })

  useEffect(() => {
    const unsubWeapons = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'weapons'),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data(), ...normalizeGearVisual(d.data()) } as WeaponItem))
        setWeapons(sortGearListItems(next))
        setLoading((l) => ({ ...l, weapons: false }))
      },
    )
    return unsubWeapons
  }, [gameId, heroId])

  useEffect(() => {
    const unsubArmor = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'armor'),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data(), ...normalizeGearVisual(d.data()) } as ArmorItem))
        setArmor(sortGearListItems(next))
        setLoading((l) => ({ ...l, armor: false }))
      },
    )
    return unsubArmor
  }, [gameId, heroId])

  useEffect(() => {
    const unsubEquipment = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'inventory'),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data(), ...normalizeGearVisual(d.data()) } as InventoryItem))
        setEquipment(sortGearListItems(next))
        setLoading((l) => ({ ...l, equipment: false }))
      },
    )
    return unsubEquipment
  }, [gameId, heroId])

  const isLoading = loading.weapons || loading.armor || loading.equipment

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
          {t('inventory.weapons.title')}
        </h2>
        <WeaponList
          gameId={gameId}
          heroId={heroId}
          items={weapons}
          readOnly={!canEdit}
        />
      </section>

      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
          {t('inventory.armor.title')}
        </h2>
        <ArmorList
          gameId={gameId}
          heroId={heroId}
          items={armor}
          readOnly={!canEdit}
        />
      </section>

      <section>
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase mb-4">
          {t('inventory.equipment.title')}
        </h2>
        <InventoryList
          gameId={gameId}
          heroId={heroId}
          items={equipment}
          readOnly={!canEdit}
        />
      </section>
    </div>
  )
}
