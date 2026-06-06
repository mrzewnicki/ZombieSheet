import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { GearTraitDefinition } from '@/types'
import { GEAR_TRAITS_COLLECTION } from '@/utils/gearTraits'

const LEGACY_WEAPON_TRAITS_COLLECTION = 'weaponTraits'

function sortTraits(traits: GearTraitDefinition[]): GearTraitDefinition[] {
  return [...traits].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

function mapSnapshot(snap: import('firebase/firestore').QuerySnapshot): GearTraitDefinition[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearTraitDefinition))
}

export function useGearTraitCatalog(gameId: string) {
  const [traits, setTraits] = useState<GearTraitDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let gearTraits: GearTraitDefinition[] = []
    let legacyTraits: GearTraitDefinition[] = []
    let gearReady = false
    let legacyReady = false
    let legacyDenied = false

    function mergeAndPublish() {
      if (!gearReady || (!legacyReady && !legacyDenied)) return
      const merged = new Map<string, GearTraitDefinition>()
      for (const trait of legacyTraits) merged.set(trait.id, trait)
      for (const trait of gearTraits) merged.set(trait.id, trait)
      setTraits(sortTraits([...merged.values()]))
      setLoading(false)
    }

    const unsubGear = onSnapshot(
      collection(db, 'games', gameId, GEAR_TRAITS_COLLECTION),
      (snap) => {
        gearTraits = mapSnapshot(snap)
        gearReady = true
        setError(null)
        mergeAndPublish()
      },
      (err) => {
        gearReady = true
        setError(err.message)
        mergeAndPublish()
      },
    )

    const unsubLegacy = onSnapshot(
      collection(db, 'games', gameId, LEGACY_WEAPON_TRAITS_COLLECTION),
      (snap) => {
        legacyTraits = mapSnapshot(snap)
        legacyReady = true
        mergeAndPublish()
      },
      () => {
        legacyDenied = true
        legacyReady = true
        mergeAndPublish()
      },
    )

    return () => {
      unsubGear()
      unsubLegacy()
    }
  }, [gameId])

  return { traits, loading, error }
}
